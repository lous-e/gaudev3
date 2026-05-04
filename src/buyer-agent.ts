import type {
  AcceptRequest,
  AcceptResponse,
  BuyerIntent,
  BuyerSession,
  BuyerStrategy,
  CounterRequest,
  CounterResponse,
  Deal,
  OpenRequest,
  OpenResponse,
  RpcMethod,
  RpcRequest,
  StatusRequest,
  SettlementResponse,
  SettleRequest,
  WalkRequest,
  WalkResponse
} from "./types";
import { writeBuyerAudit } from "./audit";
import { decideBuyerMove, nextBuyerCounter } from "./heuristics";
import { createMockAuthToken } from "./protocol-security";
import { validateBuyerAction } from "./validation";

export type HumanConfirmationPrompt = (summary: string) => Promise<boolean>;

export type BuyerNegotiationResult = {
  settled: boolean;
  deal?: Deal;
  txHash?: string;
  artifact?: string;
  transcript?: string[];
};

export type BuyerLoopSkeleton = {
  sellerUrl: string;
  sellerPubkey: string;
  openingOffer: number;
  openEnvelope: BuyerOpenEnvelope;
  confirmationSummary: string;
};

type OutboundRpcEnvelope<TBody, TMethod extends RpcMethod> = RpcRequest<TBody> & {
  method: TMethod;
};

type SignableRpcBody =
  | OpenRequest
  | CounterRequest
  | AcceptRequest
  | WalkRequest
  | StatusRequest;

type SettlementEnvelope = {
  protocol: "nuff/v1";
  method: "bidmesh.negotiate.settle";
  deal_id: string;
  from_pubkey: string;
  to_pubkey: string;
  round: number;
  timestamp: string;
  expires_at?: string;
  signature: "mock";
  body: SettleRequest;
};

export type BuyerOpenEnvelope = OutboundRpcEnvelope<
  OpenRequest,
  "bidmesh.negotiate.open"
>;

type BuyerCounterEnvelope = OutboundRpcEnvelope<
  CounterRequest,
  "bidmesh.negotiate.counter"
>;

type BuyerAcceptEnvelope = OutboundRpcEnvelope<
  AcceptRequest,
  "bidmesh.negotiate.accept"
>;

type BuyerWalkEnvelope = OutboundRpcEnvelope<WalkRequest, "bidmesh.negotiate.walk">;

type SettlementProof = SettlementResponse;

const DEFAULT_AUTH_HEADER_NAME = "x-bidmesh-auth";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeSellerUrl(sellerUrl: string): string {
  return sellerUrl.replace(/\/+$/, "");
}

function getOpeningOffer(strategy: BuyerStrategy): number {
  return strategy.opening_offer;
}

function createEnvelope<TBody, TMethod extends RpcMethod>(params: {
  method: TMethod;
  dealId?: string;
  buyerPubkey: string;
  sellerPubkey: string;
  round: number;
  body: TBody;
}): OutboundRpcEnvelope<TBody, TMethod> {
  return {
    protocol: "nuff/v1",
    method: params.method,
    deal_id: params.dealId,
    from_pubkey: params.buyerPubkey,
    to_pubkey: params.sellerPubkey,
    round: params.round,
    timestamp: nowIso(),
    signature: "mock",
    body: params.body
  };
}

function signEnvelope(
  envelope: OutboundRpcEnvelope<SignableRpcBody, RpcMethod> | SettlementEnvelope,
  session: BuyerSession
): string {
  return createMockAuthToken(
    {
      protocol: envelope.protocol,
      method: envelope.method,
      deal_id: envelope.deal_id,
      from_pubkey: envelope.from_pubkey,
      to_pubkey: envelope.to_pubkey,
      round: envelope.round,
      timestamp: envelope.timestamp,
      expires_at: envelope.expires_at,
      body: envelope.body
    },
    session.shared_secret
  );
}

export function buildOpenEnvelope(
  intent: BuyerIntent,
  strategy: BuyerStrategy,
  sellerPubkey: string,
  buyerPubkey: string
): BuyerOpenEnvelope {
  const openingOffer = getOpeningOffer(strategy);

  return createEnvelope({
    method: "bidmesh.negotiate.open",
    buyerPubkey,
    sellerPubkey,
    round: 1,
    body: {
      intent_summary: `${intent.quantity} ${intent.item}`,
      item: intent.item,
      quantity: intent.quantity,
      constraints: intent.must_have,
      initial_offer: openingOffer,
      currency: intent.currency,
      deadline: intent.deadline
    }
  });
}

export function formatConfirmationSummary(params: {
  intent: BuyerIntent;
  sellerPubkey: string;
  finalPrice: number;
  delivery?: string;
}): string {
  const delivery = params.delivery ?? params.intent.delivery_requirement ?? "not specified";

  return [
    "Confirm purchase?",
    "",
    `Item: ${params.intent.item}`,
    `Seller: ${params.sellerPubkey}`,
    `Final price: ${params.finalPrice.toFixed(2)} ${params.intent.currency}`,
    `Delivery: ${delivery}`,
    "",
    "Reply y to pay or n to cancel."
  ].join("\n");
}

export function createBuyerLoopSkeleton(
  intent: BuyerIntent,
  strategy: BuyerStrategy,
  sellerUrl: string,
  sellerPubkey: string,
  buyerPubkey: string
): BuyerLoopSkeleton {
  const normalizedSellerUrl = normalizeSellerUrl(sellerUrl);
  const openingOffer = getOpeningOffer(strategy);

  return {
    sellerUrl: normalizedSellerUrl,
    sellerPubkey,
    openingOffer,
    openEnvelope: buildOpenEnvelope(intent, strategy, sellerPubkey, buyerPubkey),
    confirmationSummary: formatConfirmationSummary({
      intent,
      sellerPubkey,
      finalPrice: openingOffer
    })
  };
}

function buildCounterEnvelope(params: {
  dealId: string;
  buyerPubkey: string;
  sellerPubkey: string;
  round: number;
  price: number;
  intent: BuyerIntent;
}): BuyerCounterEnvelope {
  return createEnvelope({
    method: "bidmesh.negotiate.counter",
    dealId: params.dealId,
    buyerPubkey: params.buyerPubkey,
    sellerPubkey: params.sellerPubkey,
    round: params.round,
    body: {
      deal_id: params.dealId,
      price: params.price,
      currency: params.intent.currency
    }
  });
}

function buildAcceptEnvelope(params: {
  dealId: string;
  buyerPubkey: string;
  sellerPubkey: string;
  round: number;
  acceptedPrice: number;
  intent: BuyerIntent;
  terms: string;
}): BuyerAcceptEnvelope {
  return createEnvelope({
    method: "bidmesh.negotiate.accept",
    dealId: params.dealId,
    buyerPubkey: params.buyerPubkey,
    sellerPubkey: params.sellerPubkey,
    round: params.round,
    body: {
      deal_id: params.dealId,
      accepted_price: params.acceptedPrice,
      currency: params.intent.currency,
      terms: params.terms
    }
  });
}

function buildWalkEnvelope(params: {
  dealId: string;
  buyerPubkey: string;
  sellerPubkey: string;
  round: number;
  reasonCode: WalkRequest["reason_code"];
  note?: string;
}): BuyerWalkEnvelope {
  return createEnvelope({
    method: "bidmesh.negotiate.walk",
    dealId: params.dealId,
    buyerPubkey: params.buyerPubkey,
    sellerPubkey: params.sellerPubkey,
    round: params.round,
    body: {
      deal_id: params.dealId,
      reason_code: params.reasonCode,
      note: params.note
    }
  });
}

async function postJson<TResponse>(
  url: string,
  body: unknown,
  authHeaderName?: string,
  authToken?: string
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authToken ? { [authHeaderName ?? DEFAULT_AUTH_HEADER_NAME]: authToken } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`POST ${url} failed with HTTP ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

async function postRpc<TResponse>(
  sellerUrl: string,
  envelope: OutboundRpcEnvelope<SignableRpcBody, RpcMethod>,
  session: BuyerSession
): Promise<TResponse> {
  return postJson<TResponse>(
    `${sellerUrl}/rpc`,
    envelope,
    session.auth_header_name,
    signEnvelope(envelope, session)
  );
}

async function writeBlockedAudit(params: {
  dealId: string;
  sellerPubkey: string;
  actionPrice: number;
  cap: number;
  reason: string;
}): Promise<void> {
  await writeBuyerAudit({
    timestamp: nowIso(),
    session_id: "demo-session",
    deal_id: params.dealId,
    counterparty_pubkey: params.sellerPubkey,
    action: "blocked",
    attempted_price: params.actionPrice,
    cap: params.cap,
    allowed: false,
    reason: params.reason
  });
}

function resolveSettlementUrl(sellerUrl: string, settlementUrl: string): string {
  const baseUrl = new URL(`${normalizeSellerUrl(sellerUrl)}/`);
  const resolvedUrl = new URL(settlementUrl, baseUrl);
  if (resolvedUrl.origin !== baseUrl.origin) {
    throw new Error("Settlement URL origin mismatch.");
  }
  return resolvedUrl.toString();
}

async function validateOutboundOrWalk(params: {
  action: "open" | "counter" | "accept" | "settle";
  price: number;
  intent: BuyerIntent;
  humanConfirmed: boolean;
  session: BuyerSession;
  sellerUrl: string;
  sellerPubkey: string;
  dealId: string;
  round: number;
}): Promise<boolean> {
  const validation = validateBuyerAction(
    params.action,
    params.price,
    params.intent,
    params.humanConfirmed
  );

  if (validation.allow) {
    return true;
  }

  await writeBlockedAudit({
    dealId: params.dealId,
    sellerPubkey: params.sellerPubkey,
    actionPrice: params.price,
    cap: params.intent.max_price,
    reason: validation.reason
  });

  if (params.dealId !== "pending") {
    await sendWalk({
      sellerUrl: params.sellerUrl,
      buyerPubkey: params.session.buyer_pubkey,
      session: params.session,
      sellerPubkey: params.sellerPubkey,
      dealId: params.dealId,
      round: params.round,
      reasonCode: "validation_denied",
      note: validation.reason
    });
  }

  return false;
}

async function sendWalk(params: {
  sellerUrl: string;
  buyerPubkey: string;
  session: BuyerSession;
  sellerPubkey: string;
  dealId: string;
  round: number;
  reasonCode: WalkRequest["reason_code"];
  note?: string;
}): Promise<WalkResponse> {
  return postRpc<WalkResponse>(
    params.sellerUrl,
    buildWalkEnvelope({
      dealId: params.dealId,
      buyerPubkey: params.buyerPubkey,
      sellerPubkey: params.sellerPubkey,
      round: params.round,
      reasonCode: params.reasonCode,
      note: params.note
    }),
    params.session
  );
}

function buildDeal(params: {
  dealId: string;
  phase: Deal["phase"];
  round: number;
  currentPrice?: number;
  buyerPubkey: string;
  sellerPubkey: string;
  intent: BuyerIntent;
  item: string;
}): Deal {
  const timestamp = nowIso();

  return {
    deal_id: params.dealId,
    protocol: "nuff/v1",
    phase: params.phase,
    round: params.round,
    current_price: params.currentPrice,
    buyer_pubkey: params.buyerPubkey,
    seller_pubkey: params.sellerPubkey,
    intent_summary: `${params.intent.quantity} ${params.intent.item}`,
    item: params.item,
    quantity: params.intent.quantity,
    currency: params.intent.currency,
    buyer_constraints: params.intent.must_have,
    buyer_deadline: params.intent.deadline,
    created_at: timestamp,
    updated_at: timestamp
  };
}

function isAcceptResponse(response: AcceptResponse | WalkResponse): response is AcceptResponse {
  return (
    "accepted" in response &&
    response.accepted === true &&
    "settlement_url" in response &&
    "payment_required" in response
  );
}

async function acceptAndMaybeSettle(params: {
  sellerUrl: string;
  sellerPubkey: string;
  dealId: string;
  round: number;
  acceptedPrice: number;
  terms: string;
  intent: BuyerIntent;
  askForHumanConfirmation: HumanConfirmationPrompt;
  session: BuyerSession;
  transcript: string[];
}): Promise<BuyerNegotiationResult> {
  const acceptRound = params.round + 1;
  const postAcceptRound = acceptRound + 1;
  const acceptAllowed = await validateOutboundOrWalk({
    action: "accept",
    price: params.acceptedPrice,
    intent: params.intent,
    humanConfirmed: false,
    session: params.session,
    sellerUrl: params.sellerUrl,
    sellerPubkey: params.sellerPubkey,
    dealId: params.dealId,
    round: acceptRound
  });

  if (!acceptAllowed) {
    params.transcript.push(
      `[Buyer] Blocked accept at ${params.acceptedPrice.toFixed(2)} ${params.intent.currency}`
    );
    return {
      settled: false,
      transcript: params.transcript,
      deal: buildDeal({
        dealId: params.dealId,
        phase: "walked",
        round: params.round,
        currentPrice: params.acceptedPrice,
        buyerPubkey: params.session.buyer_pubkey,
        sellerPubkey: params.sellerPubkey,
        intent: params.intent,
        item: params.intent.item
      })
    };
  }

  const acceptResponse = await postRpc<AcceptResponse | WalkResponse>(
    params.sellerUrl,
    buildAcceptEnvelope({
      dealId: params.dealId,
      buyerPubkey: params.session.buyer_pubkey,
      sellerPubkey: params.sellerPubkey,
      round: acceptRound,
      acceptedPrice: params.acceptedPrice,
      intent: params.intent,
      terms: params.terms
    }),
    params.session
  );

  if (!isAcceptResponse(acceptResponse)) {
    params.transcript.push("[Seller] Walked during accept");
    return {
      settled: false,
      transcript: params.transcript,
      deal: buildDeal({
        dealId: params.dealId,
        phase: "walked",
        round: params.round,
        currentPrice: params.acceptedPrice,
        buyerPubkey: params.session.buyer_pubkey,
        sellerPubkey: params.sellerPubkey,
        intent: params.intent,
        item: params.intent.item
      })
    };
  }

  const summary = [
    params.transcript.join("\n"),
    "",
    formatConfirmationSummary({
      intent: params.intent,
      sellerPubkey: params.sellerPubkey,
      finalPrice: params.acceptedPrice,
      delivery: params.terms
    })
  ].join("\n");
  const humanConfirmed = await params.askForHumanConfirmation(summary);

  if (!humanConfirmed) {
    params.transcript.push("[Human] Declined payment confirmation");
    const settlementBlocked = !(await validateOutboundOrWalk({
      action: "settle",
      price: acceptResponse.payment_required.amount,
      intent: params.intent,
      humanConfirmed,
      session: params.session,
      sellerUrl: params.sellerUrl,
      sellerPubkey: params.sellerPubkey,
      dealId: params.dealId,
      round: postAcceptRound
    }));

    if (settlementBlocked) {
      return {
        settled: false,
        transcript: params.transcript,
        deal: buildDeal({
          dealId: params.dealId,
          phase: "walked",
          round: params.round,
          currentPrice: params.acceptedPrice,
          buyerPubkey: params.session.buyer_pubkey,
          sellerPubkey: params.sellerPubkey,
          intent: params.intent,
          item: params.intent.item
        })
      };
    }

    await sendWalk({
      sellerUrl: params.sellerUrl,
      buyerPubkey: params.session.buyer_pubkey,
      session: params.session,
      sellerPubkey: params.sellerPubkey,
      dealId: params.dealId,
      round: postAcceptRound,
      reasonCode: "human_confirmation_required",
      note: "Human declined payment confirmation."
    });

    return {
      settled: false,
      transcript: params.transcript,
      deal: buildDeal({
        dealId: params.dealId,
        phase: "walked",
        round: params.round,
        currentPrice: params.acceptedPrice,
        buyerPubkey: params.session.buyer_pubkey,
        sellerPubkey: params.sellerPubkey,
        intent: params.intent,
        item: params.intent.item
      })
    };
  }

  const settlementAllowed = await validateOutboundOrWalk({
    action: "settle",
    price: acceptResponse.payment_required.amount,
    intent: params.intent,
    humanConfirmed,
    session: params.session,
    sellerUrl: params.sellerUrl,
    sellerPubkey: params.sellerPubkey,
    dealId: params.dealId,
    round: postAcceptRound
  });

  if (!settlementAllowed) {
    params.transcript.push(
      `[Buyer] Blocked settlement at ${acceptResponse.payment_required.amount.toFixed(2)} ${params.intent.currency}`
    );
    return {
      settled: false,
      transcript: params.transcript,
      deal: buildDeal({
        dealId: params.dealId,
        phase: "walked",
        round: params.round,
        currentPrice: params.acceptedPrice,
        buyerPubkey: params.session.buyer_pubkey,
        sellerPubkey: params.sellerPubkey,
        intent: params.intent,
        item: params.intent.item
      })
    };
  }

  const settlementUrl = resolveSettlementUrl(
    params.sellerUrl,
    acceptResponse.settlement_url
  );
  const settlementRequest: SettleRequest = {
    deal_id: params.dealId,
    accepted_price: params.acceptedPrice,
    currency: params.intent.currency,
    buyer_pubkey: params.session.buyer_pubkey,
    human_confirmation: true,
    settlement_nonce: acceptResponse.payment_required.settlement_nonce
  };
  const settlementEnvelope: SettlementEnvelope = {
    protocol: "nuff/v1",
    method: "bidmesh.negotiate.settle",
    deal_id: params.dealId,
    from_pubkey: params.session.buyer_pubkey,
    to_pubkey: params.sellerPubkey,
    round: postAcceptRound,
    timestamp: nowIso(),
    expires_at: acceptResponse.payment_required.expires_at,
    signature: "mock",
    body: settlementRequest
  };

  const settledProof = await postJson<SettlementProof>(
    settlementUrl,
    settlementEnvelope,
    params.session.auth_header_name,
    signEnvelope(settlementEnvelope, params.session)
  );

  params.transcript.push(`[Settled] txHash: ${settledProof.tx_hash}`);
  params.transcript.push(`[Artifact] ${settledProof.proof_artifact.reference}`);

  return {
    settled: true,
    deal: buildDeal({
      dealId: params.dealId,
      phase: "settled",
      round: postAcceptRound,
      currentPrice: params.acceptedPrice,
      buyerPubkey: params.session.buyer_pubkey,
      sellerPubkey: params.sellerPubkey,
      intent: params.intent,
      item: params.intent.item
    }),
    txHash: settledProof.tx_hash,
    artifact: settledProof.proof_artifact.reference,
    transcript: params.transcript
  };
}

export async function runBuyerNegotiation(
  intent: BuyerIntent,
  strategy: BuyerStrategy,
  sellerUrl: string,
  sellerPubkey: string,
  askForHumanConfirmation: HumanConfirmationPrompt,
  session: BuyerSession
): Promise<BuyerNegotiationResult> {
  const skeleton = createBuyerLoopSkeleton(
    intent,
    strategy,
    sellerUrl,
    sellerPubkey,
    session.buyer_pubkey
  );
  const targetPrice = intent.target_price ?? strategy.preferred_price;
  const transcript = [`[Buyer] Opening at ${skeleton.openingOffer.toFixed(2)} ${intent.currency}`];

  const openAllowed = await validateOutboundOrWalk({
    action: "open",
    price: skeleton.openingOffer,
    intent,
    humanConfirmed: false,
    session,
    sellerUrl: skeleton.sellerUrl,
    sellerPubkey,
    dealId: "pending",
    round: skeleton.openEnvelope.round
  });

  if (!openAllowed) {
    transcript.push(`[Buyer] Blocked open at ${skeleton.openingOffer.toFixed(2)} ${intent.currency}`);
    return { settled: false, transcript };
  }

  const openResponse = await postRpc<OpenResponse>(
    skeleton.sellerUrl,
    skeleton.openEnvelope,
    session
  );
  const dealId = openResponse.deal_id;
  let round = 1;
  let lastBuyerPrice = skeleton.openingOffer;
  let sellerPrice = openResponse.accepted
    ? openResponse.price
    : openResponse.counter_price;
  let terms = openResponse.terms ?? intent.delivery_requirement ?? "not specified";
  if (sellerPrice !== undefined) {
    transcript.push(
      `[Seller] ${openResponse.accepted ? "Accept" : "Counter"}: ${sellerPrice.toFixed(2)} ${intent.currency}`
    );
  }

  if (openResponse.accepted) {
    return acceptAndMaybeSettle({
      sellerUrl: skeleton.sellerUrl,
      sellerPubkey,
      dealId,
      round,
      acceptedPrice: sellerPrice ?? lastBuyerPrice,
      terms,
      intent,
      askForHumanConfirmation,
      session,
      transcript
    });
  }

  while (round < intent.max_rounds && sellerPrice !== undefined) {
    const move = decideBuyerMove({
      sellerPrice,
      targetPrice,
      maxPrice: intent.max_price,
      round,
      maxRounds: intent.max_rounds
    });

    if (move === "accept") {
      return acceptAndMaybeSettle({
        sellerUrl: skeleton.sellerUrl,
        sellerPubkey,
        dealId,
        round,
        acceptedPrice: sellerPrice,
        terms,
        intent,
        askForHumanConfirmation,
        session,
        transcript
      });
    }

    if (move === "walk") {
      const walkRound = round + 1;
      transcript.push(
        `[Buyer] Walk: seller price ${sellerPrice.toFixed(2)} exceeds max ${intent.max_price.toFixed(2)} ${intent.currency}`
      );
      await sendWalk({
        sellerUrl: skeleton.sellerUrl,
        buyerPubkey: session.buyer_pubkey,
        session,
        sellerPubkey,
        dealId,
        round: walkRound,
        reasonCode: "price_too_high",
        note: `Seller price ${sellerPrice} exceeds max price ${intent.max_price}.`
      });

      return {
        settled: false,
        transcript,
        deal: buildDeal({
          dealId,
          phase: "walked",
          round: walkRound,
          currentPrice: sellerPrice,
          buyerPubkey: session.buyer_pubkey,
          sellerPubkey,
          intent,
          item: intent.item
        })
      };
    }

    round += 1;
    const counterPrice = nextBuyerCounter(
      skeleton.openingOffer,
      intent.max_price,
      round,
      intent.max_rounds
    );
    const counterAllowed = await validateOutboundOrWalk({
      action: "counter",
      price: counterPrice,
      intent,
      humanConfirmed: false,
      session,
      sellerUrl: skeleton.sellerUrl,
      sellerPubkey,
      dealId,
      round
    });

    if (!counterAllowed) {
      transcript.push(`[Buyer] Blocked counter at ${counterPrice.toFixed(2)} ${intent.currency}`);
      return {
        settled: false,
        transcript,
        deal: buildDeal({
          dealId,
          phase: "walked",
          round,
          currentPrice: counterPrice,
          buyerPubkey: session.buyer_pubkey,
          sellerPubkey,
          intent,
          item: intent.item
        })
      };
    }

    lastBuyerPrice = counterPrice;
    transcript.push(`[Buyer] Counter: ${counterPrice.toFixed(2)} ${intent.currency}`);
    const counterResponse = await postRpc<CounterResponse>(
      skeleton.sellerUrl,
      buildCounterEnvelope({
        dealId,
        buyerPubkey: session.buyer_pubkey,
        sellerPubkey,
        round,
        price: counterPrice,
        intent
      }),
      session
    );

    if ("terms" in counterResponse && counterResponse.terms !== undefined) {
      terms = counterResponse.terms;
    }

    if (counterResponse.accepted) {
      transcript.push(`[Seller] Accept: ${lastBuyerPrice.toFixed(2)} ${intent.currency}`);
      return acceptAndMaybeSettle({
        sellerUrl: skeleton.sellerUrl,
        sellerPubkey,
        dealId,
        round,
        acceptedPrice: lastBuyerPrice,
        terms,
        intent,
        askForHumanConfirmation,
        session,
        transcript
      });
    }

    sellerPrice = counterResponse.counter_price;
    if (sellerPrice !== undefined) {
      transcript.push(`[Seller] Counter: ${sellerPrice.toFixed(2)} ${intent.currency}`);
    }
  }

  transcript.push("[Buyer] Walk: round limit reached");
  const walkRound = round + 1;
  await sendWalk({
    sellerUrl: skeleton.sellerUrl,
    buyerPubkey: session.buyer_pubkey,
    session,
    sellerPubkey,
    dealId,
    round: walkRound,
    reasonCode: "round_limit",
    note: "Buyer reached max negotiation rounds."
  });

  return {
    settled: false,
    transcript,
    deal: buildDeal({
      dealId,
      phase: "walked",
      round: walkRound,
      currentPrice: sellerPrice,
      buyerPubkey: session.buyer_pubkey,
      sellerPubkey,
      intent,
      item: intent.item
    })
  };
}
