import type { Request, Response } from "express";
import type {
  BuyerIntent,
  BuyerStrategy,
  Deal,
  DealPhase,
  RpcMethod,
  SellerPolicy,
  ValidationResult
} from "../types";

export type DemoEventKind =
  | "marketplace.selected"
  | "marketplace.scan_started"
  | "marketplace.seller_reviewed"
  | "marketplace.selection_finalized"
  | "policy.created"
  | "rpc.sent"
  | "rpc.received"
  | "validation.allowed"
  | "validation.blocked"
  | "human.confirmation_requested"
  | "human.approved"
  | "human.denied"
  | "settlement.mocked"
  | "deal.walked"
  | "deal.settled";

export type DemoEventSide =
  | "buyer"
  | "seller"
  | "shim"
  | "human"
  | "settlement"
  | "system";

export type DemoDealEvent = {
  id: string;
  deal_id: string;
  timestamp: string;
  kind: DemoEventKind;
  side: DemoEventSide;
  round?: number;
  price?: number;
  method?: RpcMethod;
  reason_code?: string;
  human_text: string;
  agent_payload: unknown;
};

export type DemoSellerAgent = {
  id: string;
  handle: string;
  pubkey: string;
  endpoint: string;
  policy: SellerPolicy;
  tags: string[];
  rating: number;
  settled_count: number;
};

export type DemoDealRecord = {
  deal: Deal;
  seller: DemoSellerAgent;
  intent: BuyerIntent;
  strategy: BuyerStrategy;
  phase: DealPhase;
  events: DemoDealEvent[];
  current_price?: number;
  round: number;
  pending_approval?: {
    amount: number;
    terms: string;
  };
  receipt?: {
    txHash: string;
    artifact: string;
    amount: number;
    network: "base-sepolia";
    asset: "USDC";
  };
  market_scan: {
    searched_count: number;
    matching_count: number;
    selected_seller_id: string;
    selected_reason: string;
    completed: boolean;
    candidates: Array<{
      seller_id: string;
      handle: string;
      status: "selected" | "viable" | "rejected";
      final_price?: number;
      rounds: number;
      reason: string;
      fulfillment_terms: string;
      rating: number;
      inventory_available: number;
      delivery_estimate?: string;
    }>;
  };
};

export type DemoBackendState = {
  sellers: DemoSellerAgent[];
  deals: Map<string, DemoDealRecord>;
  clients: Map<string, Set<Response>>;
  event_seq: number;
  deal_seq: number;
  tx_seq: number;
};

export function createDemoBackendState(): DemoBackendState {
  return {
    sellers: seedSellers(),
    deals: new Map(),
    clients: new Map(),
    event_seq: 0,
    deal_seq: 0,
    tx_seq: 0
  };
}

export function listSellers(state: DemoBackendState): DemoSellerAgent[] {
  return state.sellers;
}

export function listDeals(state: DemoBackendState): unknown[] {
  return Array.from(state.deals.values())
    .sort((left, right) =>
      Date.parse(right.deal.updated_at) - Date.parse(left.deal.updated_at)
    )
    .map((record) => serializeDeal(record));
}

export function createDealFromRequest(
  state: DemoBackendState,
  body: unknown
): DemoDealRecord {
  if (!isRecord(body)) {
    throw httpError(400, "Request body must be an object.");
  }

  const intent = parseBuyerIntent(body.intent);
  const strategy = parseBuyerStrategy(body.strategy, intent);
  const sellerId = typeof body.seller_id === "string" ? body.seller_id : "";
  const candidateSellers = selectCandidateSellers(state.sellers, intent, sellerId);

  if (candidateSellers.length === 0) {
    throw httpError(404, sellerId
      ? `Unknown seller_id: ${sellerId}`
      : `No sellers available for item: ${intent.item}`);
  }

  const marketScan = buildMarketScan(candidateSellers, intent, strategy);
  const seller = candidateSellers.find((candidate) => candidate.id === marketScan.selected_seller_id) ?? candidateSellers[0];
  const now = nowIso();
  const dealId = nextDealId(state);
  const deal: Deal = {
    deal_id: dealId,
    protocol: "nuff/v1",
    intent_summary: `${intent.quantity}x ${intent.item}`,
    phase: "open",
    round: 1,
    buyer_pubkey: "mock-buyer-pubkey",
    seller_pubkey: seller.pubkey,
    item: intent.item,
    quantity: intent.quantity,
    currency: intent.currency,
    buyer_constraints: intent.must_have,
    buyer_deadline: intent.deadline,
    created_at: now,
    updated_at: now
  };

  const record: DemoDealRecord = {
    deal,
    seller,
    intent,
    strategy,
    phase: "open",
    events: [],
    round: 1,
    market_scan: marketScan
  };

  state.deals.set(dealId, record);
  emitEvent(state, record, {
    kind: "policy.created",
    side: "human",
    human_text: `Buyer cap set at ${formatPrice(intent.max_price)}; validation shims enforce before spend.`,
    price: intent.max_price,
    agent_payload: {
      intent,
      strategy
    }
  });

  queueMicrotask(() => runMarketScan(state, record));
  return record;
}

export function getDealOrThrow(
  state: DemoBackendState,
  dealId: string
): DemoDealRecord {
  const record = state.deals.get(dealId);

  if (!record) {
    throw httpError(404, `Unknown deal_id: ${dealId}`);
  }

  return record;
}

export function attachSseClient(
  state: DemoBackendState,
  dealId: string,
  request: Request,
  response: Response
): void {
  const record = getDealOrThrow(state, dealId);

  response.writeHead(200, {
    "cache-control": "no-cache",
    connection: "keep-alive",
    "content-type": "text/event-stream",
    "x-accel-buffering": "no"
  });

  response.write(": connected\n\n");
  for (const event of record.events) {
    writeSse(response, event);
  }

  const clients = state.clients.get(dealId) ?? new Set<Response>();
  clients.add(response);
  state.clients.set(dealId, clients);

  request.on("close", () => {
    clients.delete(response);
    if (clients.size === 0) {
      state.clients.delete(dealId);
    }
  });
}

export function approveDeal(
  state: DemoBackendState,
  dealId: string
): DemoDealRecord {
  const record = getDealOrThrow(state, dealId);

  if (!record.pending_approval) {
    throw httpError(409, "Deal is not waiting for approval.");
  }

  emitEvent(state, record, {
    kind: "human.approved",
    side: "human",
    human_text: `Human approved ${formatPrice(record.pending_approval.amount)}.`,
    price: record.pending_approval.amount,
    agent_payload: {
      approval: "approved",
      deal_id: dealId
    }
  });

  const validation = validateBuyerActionDemo(
    "settle",
    record.pending_approval.amount,
    record.intent,
    true
  );

  if (!validation.allow) {
    blockAndWalk(state, record, record.pending_approval.amount, validation.reason);
    return record;
  }

  emitEvent(state, record, {
    kind: "validation.allowed",
    side: "shim",
    human_text: `Shim allowed settlement at ${formatPrice(record.pending_approval.amount)}.`,
    price: record.pending_approval.amount,
    agent_payload: {
      action: "settle",
      allow: true
    }
  });

  state.tx_seq += 1;
  record.receipt = {
    txHash: `0xDEMO${String(state.tx_seq).padStart(6, "0")}`,
    artifact: `bidmesh-proof-${dealId}`,
    amount: record.pending_approval.amount,
    network: "base-sepolia",
    asset: "USDC"
  };
  record.pending_approval = undefined;
  updateDeal(record, "settled", record.round, record.current_price);

  emitEvent(state, record, {
    kind: "settlement.mocked",
    side: "settlement",
    human_text: `Mock payment sent on base-sepolia for ${formatPrice(record.receipt.amount)}.`,
    price: record.receipt.amount,
    agent_payload: record.receipt
  });
  emitEvent(state, record, {
    kind: "deal.settled",
    side: "system",
    human_text: `Deal settled with ${record.seller.handle}.`,
    price: record.receipt.amount,
    agent_payload: record.deal
  });

  return record;
}

export function denyDeal(
  state: DemoBackendState,
  dealId: string
): DemoDealRecord {
  const record = getDealOrThrow(state, dealId);

  if (!record.pending_approval) {
    throw httpError(409, "Deal is not waiting for approval.");
  }

  emitEvent(state, record, {
    kind: "human.denied",
    side: "human",
    human_text: "Human denied payment confirmation.",
    price: record.pending_approval.amount,
    agent_payload: {
      approval: "denied",
      deal_id: dealId
    }
  });

  walkDeal(state, record, "human_confirmation_required", "Payment denied; buyer walked.");
  record.pending_approval = undefined;
  return record;
}

export function forceOverCap(
  state: DemoBackendState,
  dealId: string
): DemoDealRecord {
  const record = getDealOrThrow(state, dealId);
  const attemptedPrice = roundMoney(record.intent.max_price + 2);
  const validation = validateBuyerActionDemo(
    "counter",
    attemptedPrice,
    record.intent,
    false
  );

  if (validation.allow) {
    throw httpError(409, "Forced over-cap price was unexpectedly allowed.");
  }

  blockAndWalk(state, record, attemptedPrice, validation.reason);
  record.pending_approval = undefined;
  return record;
}

export function serializeDeal(record: DemoDealRecord): unknown {
  return {
    ...record.deal,
    phase: record.phase,
    current_price: record.current_price,
    round: record.round,
    seller: sellerCard(record.seller),
    market_scan: record.market_scan,
    pending_approval: record.pending_approval,
    receipt: record.receipt,
    events: record.events
  };
}

export function sendHttpError(response: Response, error: unknown): void {
  const status = isHttpError(error) ? error.status : 500;
  const message = error instanceof Error ? error.message : "Internal server error.";

  response.status(status).json({ error: message });
}

function runNegotiation(
  state: DemoBackendState,
  record: DemoDealRecord
): void {
  if (record.phase !== "open") return;

  const opening = record.strategy.opening_offer;
  const openValidation = validateBuyerActionDemo("open", opening, record.intent, false);
  const sellerOpenValidation = validateSellerActionDemo(
    "counter",
    opening,
    record.intent.quantity,
    record.seller.policy
  );

  if (!openValidation.allow) {
    blockAndWalk(state, record, opening, openValidation.reason);
    return;
  }

  emitEvent(state, record, {
    kind: "validation.allowed",
    side: "shim",
    round: 1,
    price: opening,
    human_text: `Shim allowed opening offer at ${formatPrice(opening)}.`,
    agent_payload: { action: "open", allow: true }
  });
  emitRpc(state, record, "rpc.sent", "buyer", "bidmesh.negotiate.open", 1, opening, {
    initial_offer: opening,
    item: record.intent.item,
    quantity: record.intent.quantity,
    currency: record.intent.currency
  });

  if (!sellerOpenValidation.allow) {
    emitRpc(state, record, "rpc.received", "seller", "bidmesh.negotiate.walk", 1, opening, {
      closed: true,
      reason_code: sellerOpenValidation.reason
    });
    walkDeal(state, record, sellerOpenValidation.reason, `Seller walked: ${sellerOpenValidation.reason}.`);
    return;
  }

  let buyerPrice = opening;
  let sellerPrice = opening;
  const maxRounds = Math.min(record.intent.max_rounds, record.seller.policy.max_rounds);

  for (let round = 1; round <= maxRounds; round += 1) {
    const sellerMove = decideSellerMoveDemo({
      buyerPrice,
      listPrice: record.seller.policy.list_price,
      minPrice: record.seller.policy.min_price,
      round,
      maxRounds
    });

    if (sellerMove === "accept") {
      requestHumanConfirmation(state, record, buyerPrice, round);
      return;
    }

    if (sellerMove === "walk") {
      walkDeal(state, record, "price_too_low", "Seller walked; buyer price stayed below floor.");
      return;
    }

    sellerPrice = nextSellerCounterDemo(
      record.seller.policy.list_price,
      record.seller.policy.min_price,
      round,
      maxRounds
    );
    updateDeal(record, "countering", round, sellerPrice);
    emitRpc(state, record, "rpc.received", "seller", "bidmesh.negotiate.counter", round, sellerPrice, {
      accepted: false,
      counter_price: sellerPrice,
      terms: record.seller.policy.fulfillment_terms
    });

    const buyerMove = decideBuyerMoveDemo({
      sellerPrice,
      targetPrice: record.intent.target_price ?? record.strategy.preferred_price,
      maxPrice: record.intent.max_price,
      round,
      maxRounds
    });

    if (buyerMove === "accept") {
      requestHumanConfirmation(state, record, sellerPrice, round);
      return;
    }

    if (buyerMove === "walk") {
      walkDeal(state, record, "price_too_high", "Buyer walked; seller price exceeded cap.");
      return;
    }

    const nextRound = Math.min(round + 1, maxRounds);
    buyerPrice = nextBuyerCounterDemo(
      opening,
      record.intent.max_price,
      nextRound,
      maxRounds
    );
    const counterValidation = validateBuyerActionDemo(
      "counter",
      buyerPrice,
      record.intent,
      false
    );

    if (!counterValidation.allow) {
      blockAndWalk(state, record, buyerPrice, counterValidation.reason);
      return;
    }

    emitEvent(state, record, {
      kind: "validation.allowed",
      side: "shim",
      round: nextRound,
      price: buyerPrice,
      human_text: `Shim allowed buyer counter at ${formatPrice(buyerPrice)}.`,
      agent_payload: { action: "counter", allow: true }
    });
    emitRpc(state, record, "rpc.sent", "buyer", "bidmesh.negotiate.counter", nextRound, buyerPrice, {
      price: buyerPrice,
      currency: record.intent.currency
    });
  }

  walkDeal(state, record, "round_limit", "Round limit reached.");
}

function runMarketScan(
  state: DemoBackendState,
  record: DemoDealRecord
): void {
  const { candidates } = record.market_scan;

  emitEvent(state, record, {
    kind: "marketplace.scan_started",
    side: "system",
    human_text: `Reviewing ${record.market_scan.searched_count} candidate sellers for ${record.intent.item}.`,
    agent_payload: {
      searched_count: record.market_scan.searched_count,
      matching_count: record.market_scan.matching_count,
      item: record.intent.item
    }
  });

  candidates.forEach((candidate, index) => {
    setTimeout(() => {
      emitEvent(state, record, {
        kind: "marketplace.seller_reviewed",
        side: "system",
        human_text: candidate.status === "rejected"
          ? `${candidate.handle} was rejected: ${candidate.reason}.`
          : `${candidate.handle} came back at ${candidate.final_price != null ? formatPrice(candidate.final_price) : "no quote"} after ${candidate.rounds} rounds.`,
        price: candidate.final_price,
        agent_payload: candidate
      });
    }, 80 * index);
  });

  const finalizeDelay = 80 * candidates.length;
  setTimeout(() => {
    record.market_scan.completed = true;
    emitEvent(state, record, {
      kind: "marketplace.selection_finalized",
      side: "system",
      human_text: `${record.seller.handle} selected: ${record.market_scan.selected_reason}.`,
      price: record.market_scan.candidates.find((candidate) => candidate.seller_id === record.seller.id)?.final_price,
      agent_payload: {
        selected_seller_id: record.market_scan.selected_seller_id,
        selected_reason: record.market_scan.selected_reason,
        candidates: record.market_scan.candidates
      }
    });
    emitEvent(state, record, {
      kind: "marketplace.selected",
      side: "system",
      human_text: `${record.seller.handle} selected for ${record.intent.item}.`,
      agent_payload: sellerCard(record.seller)
    });
    runNegotiation(state, record);
  }, finalizeDelay);
}

function requestHumanConfirmation(
  state: DemoBackendState,
  record: DemoDealRecord,
  price: number,
  round: number
): void {
  const validation = validateBuyerActionDemo("accept", price, record.intent, false);

  if (!validation.allow) {
    blockAndWalk(state, record, price, validation.reason);
    return;
  }

  updateDeal(record, "accepted", round, price);
  record.pending_approval = {
    amount: price,
    terms: record.seller.policy.fulfillment_terms
  };

  emitEvent(state, record, {
    kind: "validation.allowed",
    side: "shim",
    round,
    price,
    human_text: `Shim allowed acceptance at ${formatPrice(price)}.`,
    agent_payload: { action: "accept", allow: true }
  });
  emitRpc(state, record, "rpc.sent", "buyer", "bidmesh.negotiate.accept", round, price, {
    accepted_price: price,
    currency: record.intent.currency,
    terms: record.seller.policy.fulfillment_terms
  });
  emitEvent(state, record, {
    kind: "human.confirmation_requested",
    side: "human",
    round,
    price,
    human_text: `Approve payment of ${formatPrice(price)} to ${record.seller.handle}?`,
    agent_payload: {
      deal_id: record.deal.deal_id,
      payment_required: {
        network: "base-sepolia",
        asset: "USDC",
        amount: price,
        pay_to: record.seller.pubkey
      }
    }
  });
}

function blockAndWalk(
  state: DemoBackendState,
  record: DemoDealRecord,
  price: number,
  reason: string
): void {
  emitEvent(state, record, {
    kind: "validation.blocked",
    side: "shim",
    round: record.round,
    price,
    reason_code: reason,
    human_text: `Shim blocked ${formatPrice(price)}; buyer cap is ${formatPrice(record.intent.max_price)}.`,
    agent_payload: {
      allow: false,
      reason,
      attempted_price: price,
      cap: record.intent.max_price
    }
  });
  walkDeal(state, record, "validation_denied", "Validation denied; buyer walked.");
}

function walkDeal(
  state: DemoBackendState,
  record: DemoDealRecord,
  reasonCode: string,
  humanText: string
): void {
  updateDeal(record, "walked", record.round, record.current_price);
  emitEvent(state, record, {
    kind: "deal.walked",
    side: "system",
    round: record.round,
    price: record.current_price,
    reason_code: reasonCode,
    human_text: humanText,
    agent_payload: {
      deal_id: record.deal.deal_id,
      closed: true,
      reason_code: reasonCode
    }
  });
}

function emitRpc(
  state: DemoBackendState,
  record: DemoDealRecord,
  kind: "rpc.sent" | "rpc.received",
  side: "buyer" | "seller",
  method: RpcMethod,
  round: number,
  price: number,
  body: unknown
): void {
  emitEvent(state, record, {
    kind,
    side,
    method,
    round,
    price,
    human_text: `${side === "buyer" ? "Buyer" : "Seller"} ${kind === "rpc.sent" ? "sent" : "returned"} ${method} at ${formatPrice(price)}.`,
    agent_payload: {
      protocol: "nuff/v1",
      method,
      deal_id: record.deal.deal_id,
      from_pubkey: side === "buyer" ? record.deal.buyer_pubkey : record.deal.seller_pubkey,
      to_pubkey: side === "buyer" ? record.deal.seller_pubkey : record.deal.buyer_pubkey,
      round,
      timestamp: nowIso(),
      signature: "mock",
      body
    }
  });
}

function emitEvent(
  state: DemoBackendState,
  record: DemoDealRecord,
  event: Omit<DemoDealEvent, "id" | "deal_id" | "timestamp">
): DemoDealEvent {
  state.event_seq += 1;
  const fullEvent: DemoDealEvent = {
    id: `evt_${String(state.event_seq).padStart(6, "0")}`,
    deal_id: record.deal.deal_id,
    timestamp: nowIso(),
    ...event
  };

  record.events.push(fullEvent);
  const clients = state.clients.get(record.deal.deal_id);

  if (clients) {
    for (const client of clients) {
      writeSse(client, fullEvent);
    }
  }

  return fullEvent;
}

function writeSse(response: Response, event: DemoDealEvent): void {
  response.write(`id: ${event.id}\n`);
  response.write(`event: ${event.kind}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function updateDeal(
  record: DemoDealRecord,
  phase: DealPhase,
  round: number,
  currentPrice?: number
): void {
  record.phase = phase;
  record.round = round;
  record.current_price = currentPrice;
  record.deal.phase = phase;
  record.deal.round = round;
  record.deal.current_price = currentPrice;
  record.deal.updated_at = nowIso();
}

function validateBuyerActionDemo(
  action: "open" | "counter" | "accept" | "settle",
  price: number,
  intent: BuyerIntent,
  humanConfirmed: boolean
): ValidationResult {
  if (price > intent.max_price) {
    return { allow: false, reason: "accepted_price_exceeds_max_price" };
  }

  if (
    action === "settle" &&
    intent.require_human_confirmation_before_payment &&
    !humanConfirmed
  ) {
    return { allow: false, reason: "human_confirmation_required" };
  }

  return { allow: true };
}

function validateSellerActionDemo(
  action: "accept" | "counter",
  price: number,
  quantity: number,
  policy: SellerPolicy
): ValidationResult {
  if (policy.currency !== "USDC") {
    return { allow: false, reason: "unsupported_currency" };
  }

  if (quantity > policy.inventory_available) {
    return { allow: false, reason: "inventory_unavailable" };
  }

  if (action === "accept" && price < policy.min_price) {
    return { allow: false, reason: "price_too_low" };
  }

  return { allow: true };
}

function decideBuyerMoveDemo(params: {
  sellerPrice: number;
  targetPrice: number;
  maxPrice: number;
  round: number;
  maxRounds: number;
}): "accept" | "counter" | "walk" {
  if (params.sellerPrice <= params.targetPrice) return "accept";
  if (params.sellerPrice <= params.maxPrice && params.round >= params.maxRounds) return "accept";
  if (params.sellerPrice > params.maxPrice && params.round >= params.maxRounds) return "walk";
  return "counter";
}

function decideSellerMoveDemo(params: {
  buyerPrice: number;
  listPrice: number;
  minPrice: number;
  round: number;
  maxRounds: number;
}): "accept" | "counter" | "walk" {
  if (params.buyerPrice >= params.listPrice) return "accept";
  if (params.buyerPrice >= params.minPrice && params.round >= params.maxRounds) return "accept";
  if (params.buyerPrice < params.minPrice && params.round >= params.maxRounds) return "walk";
  return "counter";
}

function nextBuyerCounterDemo(
  openingOffer: number,
  maxPrice: number,
  round: number,
  maxRounds: number
): number {
  return roundMoney(Math.min(
    maxPrice,
    openingOffer + ((maxPrice - openingOffer) * round) / maxRounds
  ));
}

function nextSellerCounterDemo(
  listPrice: number,
  minPrice: number,
  round: number,
  maxRounds: number
): number {
  return roundMoney(Math.max(
    minPrice,
    listPrice - ((listPrice - minPrice) * round) / maxRounds
  ));
}

function parseBuyerIntent(value: unknown): BuyerIntent {
  if (!isRecord(value)) {
    throw httpError(400, "intent must be an object.");
  }

  const intent: BuyerIntent = {
    item: readString(value, "item"),
    quantity: readPositiveNumber(value, "quantity"),
    must_have: isRecord(value.must_have) ? value.must_have as Record<string, string | number | boolean> : {},
    nice_to_have: isRecord(value.nice_to_have) ? value.nice_to_have as Record<string, string | number | boolean> : undefined,
    max_price: readPositiveNumber(value, "max_price"),
    target_price: typeof value.target_price === "number" ? value.target_price : undefined,
    currency: "USDC",
    deadline: typeof value.deadline === "string" ? value.deadline : undefined,
    delivery_requirement: typeof value.delivery_requirement === "string" ? value.delivery_requirement : undefined,
    negotiation_style: readEnum(value, "negotiation_style", ["fast", "balanced", "patient"], "balanced"),
    max_rounds: Math.max(1, Math.floor(readPositiveNumber(value, "max_rounds"))),
    allow_partial_match: typeof value.allow_partial_match === "boolean" ? value.allow_partial_match : false,
    require_human_confirmation_above: typeof value.require_human_confirmation_above === "number"
      ? value.require_human_confirmation_above
      : undefined,
    require_human_confirmation_before_payment: typeof value.require_human_confirmation_before_payment === "boolean"
      ? value.require_human_confirmation_before_payment
      : true
  };

  if (value.currency !== "USDC") {
    throw httpError(400, "Only currency USDC is supported in the demo backend.");
  }

  return intent;
}

function parseBuyerStrategy(value: unknown, intent: BuyerIntent): BuyerStrategy {
  if (!isRecord(value)) {
    const opening = roundMoney(Math.min(intent.target_price ?? intent.max_price * 0.8, intent.max_price));

    return {
      opening_offer: opening,
      preferred_price: intent.target_price ?? opening,
      concession_schedule: "linear",
      walkaway_after_rounds: intent.max_rounds
    };
  }

  return {
    opening_offer: readPositiveNumber(value, "opening_offer"),
    preferred_price: typeof value.preferred_price === "number"
      ? value.preferred_price
      : intent.target_price ?? intent.max_price,
    concession_schedule: readEnum(value, "concession_schedule", ["linear", "split_difference", "slow_then_fast"], "linear"),
    walkaway_after_rounds: typeof value.walkaway_after_rounds === "number"
      ? Math.max(1, Math.floor(value.walkaway_after_rounds))
      : intent.max_rounds
  };
}

function selectCandidateSellers(
  sellers: DemoSellerAgent[],
  intent: BuyerIntent,
  sellerId: string
): DemoSellerAgent[] {
  if (sellerId) {
    return sellers.filter((candidate) => candidate.id === sellerId);
  }

  const normalizedItem = intent.item.trim().toLowerCase();
  const matched = sellers.filter((candidate) =>
    candidate.policy.item_name.toLowerCase().includes(normalizedItem) ||
    normalizedItem.includes(candidate.policy.item_name.toLowerCase().split(",")[0])
  );

  return matched.length > 0 ? matched : sellers;
}

function buildMarketScan(
  candidates: DemoSellerAgent[],
  intent: BuyerIntent,
  strategy: BuyerStrategy
): DemoDealRecord["market_scan"] {
  const evaluations = candidates.map((seller) => evaluateSellerCandidate(seller, intent, strategy));
  const viable = evaluations.filter((evaluation) => evaluation.status !== "rejected");
  const selected = [...viable].sort((left, right) => {
    const priceDelta = (left.final_price ?? Number.POSITIVE_INFINITY) - (right.final_price ?? Number.POSITIVE_INFINITY);
    if (priceDelta !== 0) return priceDelta;
    return right.rating - left.rating;
  })[0] ?? [...evaluations].sort((left, right) => left.seller_id.localeCompare(right.seller_id))[0];

  const candidatesWithSelection = evaluations.map((evaluation) => ({
    ...evaluation,
    status: evaluation.seller_id === selected.seller_id ? "selected" : evaluation.status
  }));

  return {
    searched_count: candidates.length,
    matching_count: candidates.length,
    selected_seller_id: selected.seller_id,
    selected_reason: selected.reason,
    completed: false,
    candidates: candidatesWithSelection
  };
}

function evaluateSellerCandidate(
  seller: DemoSellerAgent,
  intent: BuyerIntent,
  strategy: BuyerStrategy
): DemoDealRecord["market_scan"]["candidates"][number] {
  const maxRounds = Math.min(intent.max_rounds, seller.policy.max_rounds);
  let buyerPrice = strategy.opening_offer;

  for (let round = 1; round <= maxRounds; round += 1) {
    const sellerMove = decideSellerMoveDemo({
      buyerPrice,
      listPrice: seller.policy.list_price,
      minPrice: seller.policy.min_price,
      round,
      maxRounds
    });

    if (sellerMove === "accept") {
      return {
        seller_id: seller.id,
        handle: seller.handle,
        status: "viable",
        final_price: buyerPrice,
        rounds: round,
        reason: buyerPrice <= intent.max_price
          ? `best price within cap at ${formatPrice(buyerPrice)}`
          : `above cap at ${formatPrice(buyerPrice)}`,
        fulfillment_terms: seller.policy.fulfillment_terms,
        rating: seller.rating,
        inventory_available: seller.policy.inventory_available,
        delivery_estimate: seller.policy.delivery_estimate
      };
    }

    if (sellerMove === "walk") {
      return {
        seller_id: seller.id,
        handle: seller.handle,
        status: "rejected",
        rounds: round,
        reason: "seller floor stayed above buyer cap",
        fulfillment_terms: seller.policy.fulfillment_terms,
        rating: seller.rating,
        inventory_available: seller.policy.inventory_available,
        delivery_estimate: seller.policy.delivery_estimate
      };
    }

    const sellerPrice = nextSellerCounterDemo(
      seller.policy.list_price,
      seller.policy.min_price,
      round,
      maxRounds
    );

    const buyerMove = decideBuyerMoveDemo({
      sellerPrice,
      targetPrice: intent.target_price ?? strategy.preferred_price,
      maxPrice: intent.max_price,
      round,
      maxRounds
    });

    if (buyerMove === "accept") {
      return {
        seller_id: seller.id,
        handle: seller.handle,
        status: sellerPrice <= intent.max_price ? "viable" : "rejected",
        final_price: sellerPrice,
        rounds: round,
        reason: sellerPrice <= intent.max_price
          ? `seller met cap with ${formatPrice(sellerPrice)}`
          : `counter landed above cap at ${formatPrice(sellerPrice)}`,
        fulfillment_terms: seller.policy.fulfillment_terms,
        rating: seller.rating,
        inventory_available: seller.policy.inventory_available,
        delivery_estimate: seller.policy.delivery_estimate
      };
    }

    if (buyerMove === "walk") {
      return {
        seller_id: seller.id,
        handle: seller.handle,
        status: "rejected",
        final_price: sellerPrice,
        rounds: round,
        reason: `counter stayed above cap at ${formatPrice(sellerPrice)}`,
        fulfillment_terms: seller.policy.fulfillment_terms,
        rating: seller.rating,
        inventory_available: seller.policy.inventory_available,
        delivery_estimate: seller.policy.delivery_estimate
      };
    }

    buyerPrice = nextBuyerCounterDemo(
      strategy.opening_offer,
      intent.max_price,
      Math.min(round + 1, maxRounds),
      maxRounds
    );
  }

  return {
    seller_id: seller.id,
    handle: seller.handle,
    status: "rejected",
    rounds: maxRounds,
    reason: "round limit reached without a valid agreement",
    fulfillment_terms: seller.policy.fulfillment_terms,
    rating: seller.rating,
    inventory_available: seller.policy.inventory_available,
    delivery_estimate: seller.policy.delivery_estimate
  };
}

function sellerCard(seller: DemoSellerAgent): unknown {
  return {
    id: seller.id,
    handle: seller.handle,
    pubkey: seller.pubkey,
    endpoint: seller.endpoint,
    supports: ["nuff/v1", "x402/0.4"],
    policy: seller.policy,
    listing: {
      item_id: seller.policy.item_id,
      item: seller.policy.item_name,
      list_price: seller.policy.list_price,
      currency: seller.policy.currency,
      fulfillment_terms: seller.policy.fulfillment_terms,
      inventory_available: seller.policy.inventory_available
    },
    tags: seller.tags,
    rating: seller.rating,
    settled_count: seller.settled_count
  };
}

function seedSellers(): DemoSellerAgent[] {
  return [
    seller("seller-usbc-balanced", "cableworks.agent", "USB-C cable", 10, 6, 4.5, "redemption code immediately", ["hardware", "cable"], 0.97, 1429),
    seller("seller-usbc-fast", "quickcord.agent", "USB-C cable, fast ship", 22, 4.8, 4.2, "ship next day", ["hardware", "fast"], 0.95, 711),
    seller("seller-premium", "deskwarehouse.agent", "USB-C cable, braided premium", 5, 8.5, 7.25, "ship 2-day", ["hardware", "premium"], 0.91, 218),
    seller("seller-low-inventory", "lastbox.agent", "USB-C cable, low inventory", 1, 5.75, 4.9, "last unit, redemption code", ["scarce", "hardware"], 0.89, 34),
    seller("seller-over-cap", "overcap-lab.agent", "USB-C cable, adversarial ask", 12, 12, 9, "demo-only adversarial seller", ["safety-test"], 0.73, 4)
  ];
}

function seller(
  id: string,
  handle: string,
  itemName: string,
  inventory: number,
  listPrice: number,
  minPrice: number,
  fulfillment: string,
  tags: string[],
  rating: number,
  settledCount: number
): DemoSellerAgent {
  return {
    id,
    handle,
    pubkey: pubkey(handle),
    endpoint: `https://${handle}/rpc`,
    policy: {
      item_id: id,
      item_name: itemName,
      inventory_available: inventory,
      list_price: listPrice,
      min_price: minPrice,
      currency: "USDC",
      fulfillment_terms: fulfillment,
      negotiation_style: id === "seller-over-cap" ? "firm" : "balanced",
      max_rounds: 3
    },
    tags,
    rating,
    settled_count: settledCount
  };
}

function pubkey(seed: string): string {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return `0x${hash.toString(16).padStart(8, "0")}${"0".repeat(32)}`;
}

function nextDealId(state: DemoBackendState): string {
  state.deal_seq += 1;
  return `deal_${String(state.deal_seq).padStart(6, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function formatPrice(value: number): string {
  return `${value.toFixed(2)} USDC`;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  value: Record<string, unknown>,
  key: string
): string {
  const property = value[key];

  if (typeof property !== "string" || property.trim() === "") {
    throw httpError(400, `${key} must be a non-empty string.`);
  }

  return property;
}

function readPositiveNumber(
  value: Record<string, unknown>,
  key: string
): number {
  const property = value[key];

  if (typeof property !== "number" || !Number.isFinite(property) || property <= 0) {
    throw httpError(400, `${key} must be a positive number.`);
  }

  return property;
}

function readEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const property = value[key];

  return typeof property === "string" && allowed.includes(property as T)
    ? property as T
    : fallback;
}

type HttpError = Error & { status: number };

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && "status" in error && typeof error.status === "number";
}
