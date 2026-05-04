import express from "express";
import { randomUUID } from "node:crypto";
import { appendSellerAuditEntry } from "./audit";
import {
  acceptRpcRequestSchema,
  counterRpcRequestSchema,
  openRpcRequestSchema,
  settleRequestSchema,
  statusRpcRequestSchema,
  walkRpcRequestSchema
} from "./schemas";
import { decideSellerMove, nextSellerCounter } from "./heuristics";
import {
  createRequestFingerprint,
  verifyMockAuthToken
} from "./protocol-security";
import { validateSellerAction } from "./validation";
import type {
  AcceptRequest,
  ConstraintValue,
  CounterRequest,
  Deal,
  DealReasonCode,
  DealPhase,
  OpenRequest,
  OpenResponse,
  RpcMethod,
  SellerAuditEntry,
  SellerPolicy,
  SignedRpcEnvelope,
  StatusResponse,
  WalkRequest
} from "./types";

const DEFAULT_AUDIT_LOG_PATH = "seller/workspace/memory/audit.log";
const DEFAULT_SELLER_PUBKEY = "seller-pubkey";

type SellerServerOptions = {
  auditLogPath?: string;
  sellerPubkey?: string;
  buyerSecrets?: Record<string, string>;
  supportedConstraints?: Record<string, ConstraintValue>;
  now?: () => string;
  maxClockSkewMs?: number;
  replayTtlMs?: number;
  maxActiveDeals?: number;
  authHeaderName?: string;
};

type SellerState = {
  deals: Map<string, Deal>;
  availableInventory: number;
  seenFingerprints: Map<string, number>;
};

type VerifiedEnvelope<TBody> = SignedRpcEnvelope & { body: TBody };

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(new Date(timestamp).getTime() + minutes * 60_000).toISOString();
}

function activeDealCount(deals: Map<string, Deal>): number {
  let count = 0;
  for (const deal of deals.values()) {
    if (deal.phase !== "walked" && deal.phase !== "settled") {
      count += 1;
    }
  }
  return count;
}

function failureResponse(dealId: string, reason: DealReasonCode) {
  return {
    deal_id: dealId,
    accepted: false as const,
    reason_code: reason
  };
}

function isTerminalPhase(phase: DealPhase): boolean {
  return phase === "walked" || phase === "settled";
}

function pruneFingerprints(state: SellerState, nowMs: number): void {
  for (const [fingerprint, expiresAt] of state.seenFingerprints.entries()) {
    if (expiresAt <= nowMs) {
      state.seenFingerprints.delete(fingerprint);
    }
  }
}

function canonicalizeTimestamp(timestamp: string): number {
  return new Date(timestamp).getTime();
}

async function writeAudit(path: string, entry: SellerAuditEntry): Promise<void> {
  await appendSellerAuditEntry(path, entry);
}

async function logAuditEvent(input: {
  auditLogPath: string;
  dealId: string;
  counterpartyPubkey: string;
  action: SellerAuditEntry["action"];
  method: SellerAuditEntry["method"];
  requestRound?: number;
  phaseBefore?: DealPhase | "none";
  phaseAfter?: DealPhase;
  fromPubkey?: string;
  toPubkey?: string;
  envelopeTimestamp?: string;
  envelopeExpiresAt?: string;
  quantity?: number;
  attemptedPrice?: number;
  terms?: string;
  floor: number;
  allowed: boolean;
  reason?: string;
  requestFingerprint?: string;
  now: () => string;
}): Promise<void> {
  await writeAudit(input.auditLogPath, {
    timestamp: input.now(),
    deal_id: input.dealId,
    counterparty_pubkey: input.counterpartyPubkey,
    action: input.action,
    method: input.method,
    request_round: input.requestRound,
    phase_before: input.phaseBefore,
    phase_after: input.phaseAfter,
    from_pubkey: input.fromPubkey,
    to_pubkey: input.toPubkey,
    envelope_timestamp: input.envelopeTimestamp,
    envelope_expires_at: input.envelopeExpiresAt,
    quantity: input.quantity,
    attempted_price: input.attemptedPrice,
    terms: input.terms,
    floor: input.floor,
    allowed: input.allowed,
    reason: input.reason,
    request_fingerprint: input.requestFingerprint
  });
}

function releaseReservation(state: SellerState, deal: Deal): void {
  if (deal.phase === "accepted") {
    state.availableInventory += deal.quantity;
  }
}

function constraintsSatisfied(
  requested: Record<string, ConstraintValue>,
  supported: Record<string, ConstraintValue>
): boolean {
  for (const [key, value] of Object.entries(requested)) {
    if (!(key in supported) || supported[key] !== value) {
      return false;
    }
  }
  return true;
}

function buildEnvelopeForSignature<TBody>(request: VerifiedEnvelope<TBody>) {
  return {
    protocol: request.protocol,
    method: request.method,
    deal_id: request.deal_id,
    from_pubkey: request.from_pubkey,
    to_pubkey: request.to_pubkey,
    round: request.round,
    timestamp: request.timestamp,
    expires_at: request.expires_at,
    body: request.body as
      | OpenRequest
      | CounterRequest
      | AcceptRequest
      | WalkRequest
      | { deal_id: string }
  };
}

function verifyEnvelope<TBody>(
  request: VerifiedEnvelope<TBody>,
  state: SellerState,
  providedAuthToken: string | undefined,
  options: SellerServerOptions & {
    sellerPubkey: string;
    buyerSecrets: Record<string, string>;
    now: () => string;
    maxClockSkewMs: number;
    replayTtlMs: number;
  }
): { ok: true; fingerprint: string } | { ok: false; reason: DealReasonCode } {
  const secret = options.buyerSecrets[request.from_pubkey];
  if (request.to_pubkey !== options.sellerPubkey) {
    return { ok: false, reason: "validation_denied" };
  }

  const timestampMs = canonicalizeTimestamp(request.timestamp);
  const nowMs = canonicalizeTimestamp(options.now());
  if (Number.isNaN(timestampMs) || Math.abs(nowMs - timestampMs) > options.maxClockSkewMs) {
    return { ok: false, reason: "validation_denied" };
  }

  if (request.expires_at) {
    const expiresMs = canonicalizeTimestamp(request.expires_at);
    if (Number.isNaN(expiresMs) || expiresMs < nowMs) {
      return { ok: false, reason: "reservation_expired" };
    }
  }

  if (Object.keys(options.buyerSecrets).length > 0) {
    if (!secret || !providedAuthToken) {
      return { ok: false, reason: "validation_denied" };
    }
    if (!verifyMockAuthToken(buildEnvelopeForSignature(request), providedAuthToken, secret)) {
      return { ok: false, reason: "validation_denied" };
    }
  }

  pruneFingerprints(state, nowMs);
  const fingerprint = createRequestFingerprint(buildEnvelopeForSignature(request));
  if (state.seenFingerprints.has(fingerprint)) {
    return { ok: false, reason: "replay_detected" };
  }

  const ttlBase = request.expires_at
    ? canonicalizeTimestamp(request.expires_at)
    : nowMs + options.replayTtlMs;
  state.seenFingerprints.set(fingerprint, ttlBase);

  return { ok: true, fingerprint };
}

function invalidFollowUpReason(
  deal: Deal,
  fromPubkey: string,
  toPubkey: string,
  sellerPubkey: string,
  round: number
): DealReasonCode | undefined {
  if (deal.buyer_pubkey !== fromPubkey || toPubkey !== sellerPubkey) {
    return "validation_denied";
  }
  if (isTerminalPhase(deal.phase)) {
    return "validation_denied";
  }
  if (round !== deal.round + 1) {
    return "validation_denied";
  }
  return undefined;
}

async function blockExistingDeal(input: {
  state: SellerState;
  deal: Deal;
  auditLogPath: string;
  counterpartyPubkey: string;
  floor: number;
  reason: DealReasonCode;
  method: SellerAuditEntry["method"];
  requestRound?: number;
  attemptedPrice?: number;
  terms?: string;
  fromPubkey?: string;
  toPubkey?: string;
  envelopeTimestamp?: string;
  envelopeExpiresAt?: string;
  requestFingerprint?: string;
  closeDeal: boolean;
  now: () => string;
}): Promise<void> {
  const phaseBefore = input.deal.phase;
  if (input.closeDeal) {
    releaseReservation(input.state, input.deal);
    input.deal.phase = "walked";
    input.deal.reason_code = input.reason;
    input.deal.updated_at = input.now();
  }

  await logAuditEvent({
    auditLogPath: input.auditLogPath,
    dealId: input.deal.deal_id,
    counterpartyPubkey: input.counterpartyPubkey,
    action: "blocked",
    method: input.method,
    requestRound: input.requestRound,
    phaseBefore,
    phaseAfter: input.closeDeal ? input.deal.phase : phaseBefore,
    fromPubkey: input.fromPubkey,
    toPubkey: input.toPubkey,
    envelopeTimestamp: input.envelopeTimestamp,
    envelopeExpiresAt: input.envelopeExpiresAt,
    quantity: input.deal.quantity,
    attemptedPrice: input.attemptedPrice,
    terms: input.terms,
    floor: input.floor,
    allowed: false,
    reason: input.reason,
    requestFingerprint: input.requestFingerprint,
    now: input.now
  });
}

export function createSellerServer(
  policy: SellerPolicy,
  rawOptions: SellerServerOptions = {}
): express.Express {
  const options = createNormalizedOptions(rawOptions);

  const state: SellerState = {
    deals: new Map<string, Deal>(),
    availableInventory: policy.inventory_available,
    seenFingerprints: new Map<string, number>()
  };

  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.post("/rpc", async (req, res) => {
    try {
      const method = req.body?.method as RpcMethod | undefined;

      switch (method) {
        case "bidmesh.negotiate.open": {
          const request = openRpcRequestSchema.parse(req.body);
          const verification = verifyEnvelope(
            request,
            state,
            readAuthToken(req.headers[options.authHeaderName]),
            options
          );
          if (!verification.ok) {
            const transientDealId = randomUUID();
            await logAuditEvent({
              auditLogPath: options.auditLogPath,
              dealId: transientDealId,
              counterpartyPubkey: request.from_pubkey,
              action: "blocked",
              method,
              requestRound: request.round,
              phaseBefore: "none",
              phaseAfter: "walked",
              fromPubkey: request.from_pubkey,
              toPubkey: request.to_pubkey,
              envelopeTimestamp: request.timestamp,
              envelopeExpiresAt: request.expires_at,
              quantity: request.body.quantity,
              attemptedPrice: request.body.initial_offer,
              floor: policy.min_price,
              allowed: false,
              reason: verification.reason,
              now: options.now
            });
            return res.json(failureResponse(transientDealId, verification.reason));
          }
          return res.json(await handleOpen(state, policy, request, verification.fingerprint, options));
        }
        case "bidmesh.negotiate.counter": {
          const request = counterRpcRequestSchema.parse(req.body);
          const verification = verifyEnvelope(
            request,
            state,
            readAuthToken(req.headers[options.authHeaderName]),
            options
          );
          if (!verification.ok) {
            return res.json(failureResponse(request.deal_id, verification.reason));
          }
          return res.json(
            await handleCounter(state, policy, request, verification.fingerprint, options)
          );
        }
        case "bidmesh.negotiate.accept": {
          const request = acceptRpcRequestSchema.parse(req.body);
          const verification = verifyEnvelope(
            request,
            state,
            readAuthToken(req.headers[options.authHeaderName]),
            options
          );
          if (!verification.ok) {
            return res.json(failureResponse(request.deal_id, verification.reason));
          }
          return res.json(
            await handleAccept(state, policy, request, verification.fingerprint, options)
          );
        }
        case "bidmesh.negotiate.walk": {
          const request = walkRpcRequestSchema.parse(req.body);
          const verification = verifyEnvelope(
            request,
            state,
            readAuthToken(req.headers[options.authHeaderName]),
            options
          );
          if (!verification.ok) {
            return res.json({ deal_id: request.deal_id, closed: true });
          }
          return res.json(await handleWalk(state, policy, request, verification.fingerprint, options));
        }
        case "bidmesh.negotiate.status": {
          const request = statusRpcRequestSchema.parse(req.body);
          const verification = verifyEnvelope(
            request,
            state,
            readAuthToken(req.headers[options.authHeaderName]),
            options
          );
          if (!verification.ok) {
            return res.json({
              deal_id: request.body.deal_id,
              phase: "walked",
              round: 0,
              updated_at: options.now()
            });
          }
          return res.json(
            await handleStatus(state, request, verification.fingerprint, options)
          );
        }
        default:
          return res.status(400).json({ error: "unknown_method" });
      }
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "invalid_request"
      });
    }
  });

  app.post("/settle/:deal_id", async (req, res) => {
    try {
      const request = settleRequestSchema.parse(req.body);
      const dealId = String(req.params.deal_id);
      const deal = state.deals.get(dealId);
      if (!deal) {
        return res.status(404).json({ error: "deal_not_found" });
      }

      const nowTimestamp = options.now();
      const nowMs = canonicalizeTimestamp(nowTimestamp);
      const phaseBefore = deal.phase;

      if (
        deal.phase !== "accepted" ||
        deal.current_price !== request.accepted_price ||
        request.buyer_pubkey !== deal.buyer_pubkey
      ) {
        await logAuditEvent({
          auditLogPath: options.auditLogPath,
          dealId,
          counterpartyPubkey: request.buyer_pubkey,
          action: "blocked",
          method: "settle",
          phaseBefore,
          phaseAfter: phaseBefore,
          fromPubkey: request.buyer_pubkey,
          toPubkey: options.sellerPubkey,
          quantity: deal.quantity,
          attemptedPrice: request.accepted_price,
          terms: deal.seller_terms,
          floor: policy.min_price,
          allowed: false,
          reason: "settlement_amount_mismatch",
          now: options.now
        });
        return res.json({ deal_id: dealId, closed: true });
      }

      if (!request.human_confirmation) {
        await logAuditEvent({
          auditLogPath: options.auditLogPath,
          dealId,
          counterpartyPubkey: request.buyer_pubkey,
          action: "blocked",
          method: "settle",
          phaseBefore,
          phaseAfter: phaseBefore,
          fromPubkey: request.buyer_pubkey,
          toPubkey: options.sellerPubkey,
          quantity: deal.quantity,
          attemptedPrice: request.accepted_price,
          terms: deal.seller_terms,
          floor: policy.min_price,
          allowed: false,
          reason: "human_confirmation_required",
          now: options.now
        });
        return res.json({ deal_id: dealId, closed: true });
      }

      if (!deal.payment_required) {
        await blockExistingDeal({
          state,
          deal,
          auditLogPath: options.auditLogPath,
          counterpartyPubkey: request.buyer_pubkey,
          floor: policy.min_price,
          reason: "validation_denied",
          method: "settle",
          attemptedPrice: request.accepted_price,
          closeDeal: true,
          now: options.now
        });
        return res.json({ deal_id: dealId, closed: true });
      }

      const challengeExpiresAt = canonicalizeTimestamp(deal.payment_required.expires_at);
      if (Number.isNaN(challengeExpiresAt) || nowMs > challengeExpiresAt) {
        await blockExistingDeal({
          state,
          deal,
          auditLogPath: options.auditLogPath,
          counterpartyPubkey: request.buyer_pubkey,
          floor: policy.min_price,
          reason: "reservation_expired",
          method: "settle",
          attemptedPrice: request.accepted_price,
          closeDeal: true,
          now: options.now
        });
        return res.json({ deal_id: dealId, closed: true });
      }

      if (deal.buyer_deadline) {
        const buyerDeadlineMs = canonicalizeTimestamp(deal.buyer_deadline);
        if (!Number.isNaN(buyerDeadlineMs) && nowMs > buyerDeadlineMs) {
          await blockExistingDeal({
            state,
            deal,
            auditLogPath: options.auditLogPath,
            counterpartyPubkey: request.buyer_pubkey,
            floor: policy.min_price,
            reason: "deadline_mismatch",
            method: "settle",
            attemptedPrice: request.accepted_price,
            closeDeal: true,
            now: options.now
          });
          return res.json({ deal_id: dealId, closed: true });
        }
      }

      const validation = validateSellerAction(
        {
          type: "settle",
          quantity: deal.quantity,
          currency: request.currency,
          accepted_price: request.accepted_price,
          now: nowTimestamp
        },
        {
          ...policy,
          inventory_available: state.availableInventory + deal.quantity
        }
      );

      if (!validation.allow) {
        await blockExistingDeal({
          state,
          deal,
          auditLogPath: options.auditLogPath,
          counterpartyPubkey: request.buyer_pubkey,
          floor: policy.min_price,
          reason: validation.reason as DealReasonCode,
          method: "settle",
          attemptedPrice: request.accepted_price,
          closeDeal: true,
          now: options.now
        });
        return res.json({ deal_id: dealId, closed: true });
      }

      deal.phase = "settled";
      deal.tx_hash = `0xmock${dealId.replace(/-/g, "").slice(0, 12)}`;
      deal.proof_artifact = {
        type: "mock-receipt",
        reference: `proof-${dealId}`,
        delivered_at: nowTimestamp
      };
      deal.updated_at = nowTimestamp;

      await logAuditEvent({
        auditLogPath: options.auditLogPath,
        dealId,
        counterpartyPubkey: request.buyer_pubkey,
        action: "settled",
        method: "settle",
        phaseBefore,
        phaseAfter: deal.phase,
        fromPubkey: request.buyer_pubkey,
        toPubkey: options.sellerPubkey,
        quantity: deal.quantity,
        attemptedPrice: request.accepted_price,
        terms: deal.seller_terms,
        floor: policy.min_price,
        allowed: true,
        requestFingerprint: deal.request_fingerprint,
        now: options.now
      });

      return res.json({
        deal_id: dealId,
        settled: true,
        tx_hash: deal.tx_hash,
        proof_artifact: deal.proof_artifact
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "invalid_request"
      });
    }
  });

  return app;
}

async function handleOpen(
  state: SellerState,
  policy: SellerPolicy,
  request: VerifiedEnvelope<OpenRequest>,
  fingerprint: string,
  options: ReturnType<typeof createNormalizedOptions>
): Promise<OpenResponse> {
  const nowTimestamp = options.now();
  const transientDealId = randomUUID();

  if (activeDealCount(state.deals) >= options.maxActiveDeals) {
    await logAuditEvent({
      auditLogPath: options.auditLogPath,
      dealId: transientDealId,
      counterpartyPubkey: request.from_pubkey,
      action: "blocked",
      method: request.method,
      requestRound: request.round,
      phaseBefore: "none",
      phaseAfter: "walked",
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      quantity: request.body.quantity,
      attemptedPrice: request.body.initial_offer,
      terms: request.body.intent_summary,
      floor: policy.min_price,
      allowed: false,
      reason: "validation_denied",
      requestFingerprint: fingerprint,
      now: options.now
    });
    return failureResponse(transientDealId, "validation_denied");
  }

  if (request.round !== 1 || request.body.item !== policy.item_name) {
    await logAuditEvent({
      auditLogPath: options.auditLogPath,
      dealId: transientDealId,
      counterpartyPubkey: request.from_pubkey,
      action: "blocked",
      method: request.method,
      requestRound: request.round,
      phaseBefore: "none",
      phaseAfter: "walked",
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      quantity: request.body.quantity,
      attemptedPrice: request.body.initial_offer,
      terms: request.body.intent_summary,
      floor: policy.min_price,
      allowed: false,
      reason: "validation_denied",
      requestFingerprint: fingerprint,
      now: options.now
    });
    return failureResponse(transientDealId, "validation_denied");
  }

  if (!constraintsSatisfied(request.body.constraints, options.supportedConstraints)) {
    await logAuditEvent({
      auditLogPath: options.auditLogPath,
      dealId: transientDealId,
      counterpartyPubkey: request.from_pubkey,
      action: "blocked",
      method: request.method,
      requestRound: request.round,
      phaseBefore: "none",
      phaseAfter: "walked",
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      quantity: request.body.quantity,
      attemptedPrice: request.body.initial_offer,
      terms: request.body.intent_summary,
      floor: policy.min_price,
      allowed: false,
      reason: "validation_denied",
      requestFingerprint: fingerprint,
      now: options.now
    });
    return failureResponse(transientDealId, "validation_denied");
  }

  if (request.body.deadline) {
    const deadlineMs = canonicalizeTimestamp(request.body.deadline);
    if (Number.isNaN(deadlineMs) || canonicalizeTimestamp(nowTimestamp) > deadlineMs) {
      await logAuditEvent({
        auditLogPath: options.auditLogPath,
        dealId: transientDealId,
        counterpartyPubkey: request.from_pubkey,
        action: "blocked",
        method: request.method,
        requestRound: request.round,
        phaseBefore: "none",
        phaseAfter: "walked",
        fromPubkey: request.from_pubkey,
        toPubkey: request.to_pubkey,
        envelopeTimestamp: request.timestamp,
        envelopeExpiresAt: request.expires_at,
        quantity: request.body.quantity,
        attemptedPrice: request.body.initial_offer,
        terms: request.body.intent_summary,
        floor: policy.min_price,
        allowed: false,
        reason: "deadline_mismatch",
        requestFingerprint: fingerprint,
        now: options.now
      });
      return failureResponse(transientDealId, "deadline_mismatch");
    }
  }

  const validation = validateSellerAction(
    {
      type: "open",
      quantity: request.body.quantity,
      currency: request.body.currency,
      offered_price: request.body.initial_offer
    },
    {
      ...policy,
      inventory_available: state.availableInventory
    }
  );

  if (!validation.allow) {
    await logAuditEvent({
      auditLogPath: options.auditLogPath,
      dealId: transientDealId,
      counterpartyPubkey: request.from_pubkey,
      action: "blocked",
      method: request.method,
      requestRound: request.round,
      phaseBefore: "none",
      phaseAfter: "walked",
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      quantity: request.body.quantity,
      attemptedPrice: request.body.initial_offer,
      terms: request.body.intent_summary,
      floor: policy.min_price,
      allowed: false,
      reason: validation.reason,
      requestFingerprint: fingerprint,
      now: options.now
    });
    return failureResponse(transientDealId, validation.reason as DealReasonCode);
  }

  const dealId = randomUUID();
  const deal: Deal = {
    deal_id: dealId,
    protocol: "nuff/v1",
    buyer_pubkey: request.from_pubkey,
    seller_pubkey: options.sellerPubkey,
    intent_summary: request.body.intent_summary,
    item: request.body.item,
    quantity: request.body.quantity,
    currency: request.body.currency,
    buyer_constraints: request.body.constraints,
    buyer_deadline: request.body.deadline,
    phase: "open",
    round: 0,
    created_at: nowTimestamp,
    updated_at: nowTimestamp,
    request_fingerprint: fingerprint
  };

  const sellerRound = 1;
  const decision = decideSellerMove({
    buyerPrice: request.body.initial_offer,
    listPrice: policy.list_price,
    minPrice: policy.min_price,
    round: sellerRound,
    maxRounds: policy.max_rounds
  });

  deal.round = sellerRound;
  state.deals.set(dealId, deal);

  await logAuditEvent({
    auditLogPath: options.auditLogPath,
    dealId,
    counterpartyPubkey: request.from_pubkey,
    action: "open_received",
    method: request.method,
    requestRound: request.round,
    phaseBefore: "none",
    phaseAfter: deal.phase,
    fromPubkey: request.from_pubkey,
    toPubkey: request.to_pubkey,
    envelopeTimestamp: request.timestamp,
    envelopeExpiresAt: request.expires_at,
    quantity: request.body.quantity,
    attemptedPrice: request.body.initial_offer,
    terms: request.body.intent_summary,
    floor: policy.min_price,
    allowed: true,
    requestFingerprint: fingerprint,
    now: options.now
  });

  if (decision === "accept") {
    const phaseBefore = deal.phase;
    deal.phase = "countering";
    deal.current_price = request.body.initial_offer;
    deal.seller_terms = policy.fulfillment_terms;
    deal.updated_at = options.now();

    await logAuditEvent({
      auditLogPath: options.auditLogPath,
      dealId,
      counterpartyPubkey: request.from_pubkey,
      action: "seller_accepted_offer",
      method: request.method,
      requestRound: request.round,
      phaseBefore,
      phaseAfter: deal.phase,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      quantity: request.body.quantity,
      attemptedPrice: request.body.initial_offer,
      terms: policy.fulfillment_terms,
      floor: policy.min_price,
      allowed: true,
      requestFingerprint: fingerprint,
      now: options.now
    });

    return {
      deal_id: dealId,
      accepted: true,
      price: request.body.initial_offer,
      terms: policy.fulfillment_terms
    };
  }

  if (decision === "walk") {
    const phaseBefore = deal.phase;
    deal.phase = "walked";
    deal.reason_code = "price_too_low";
    deal.updated_at = options.now();

    await logAuditEvent({
      auditLogPath: options.auditLogPath,
      dealId,
      counterpartyPubkey: request.from_pubkey,
      action: "walk",
      method: request.method,
      requestRound: request.round,
      phaseBefore,
      phaseAfter: deal.phase,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      quantity: request.body.quantity,
      attemptedPrice: request.body.initial_offer,
      terms: policy.fulfillment_terms,
      floor: policy.min_price,
      allowed: true,
      reason: "price_too_low",
      requestFingerprint: fingerprint,
      now: options.now
    });

    return failureResponse(dealId, "price_too_low");
  }

  const phaseBefore = deal.phase;
  const counterPrice = nextSellerCounter({
    listPrice: policy.list_price,
    minPrice: policy.min_price,
    round: sellerRound,
    maxRounds: policy.max_rounds
  });

  deal.phase = "countering";
  deal.current_price = counterPrice;
  deal.seller_terms = policy.fulfillment_terms;
  deal.updated_at = options.now();

  await logAuditEvent({
    auditLogPath: options.auditLogPath,
    dealId,
    counterpartyPubkey: request.from_pubkey,
    action: "seller_countered",
    method: request.method,
    requestRound: request.round,
    phaseBefore,
    phaseAfter: deal.phase,
    fromPubkey: request.from_pubkey,
    toPubkey: request.to_pubkey,
    envelopeTimestamp: request.timestamp,
    envelopeExpiresAt: request.expires_at,
    quantity: request.body.quantity,
    attemptedPrice: counterPrice,
    terms: policy.fulfillment_terms,
    floor: policy.min_price,
    allowed: true,
    requestFingerprint: fingerprint,
    now: options.now
  });

  return {
    deal_id: dealId,
    accepted: false,
    counter_price: counterPrice,
    terms: policy.fulfillment_terms
  };
}

type NormalizedOptions = ReturnType<typeof createNormalizedOptions>;

function createNormalizedOptions(rawOptions: SellerServerOptions) {
  return {
    auditLogPath: rawOptions.auditLogPath ?? DEFAULT_AUDIT_LOG_PATH,
    sellerPubkey: rawOptions.sellerPubkey ?? DEFAULT_SELLER_PUBKEY,
    buyerSecrets: rawOptions.buyerSecrets ?? {},
    supportedConstraints: rawOptions.supportedConstraints ?? {},
    now: rawOptions.now ?? (() => new Date().toISOString()),
    maxClockSkewMs: rawOptions.maxClockSkewMs ?? 5 * 60_000,
    replayTtlMs: rawOptions.replayTtlMs ?? 15 * 60_000,
    maxActiveDeals: rawOptions.maxActiveDeals ?? 1_000,
    authHeaderName: rawOptions.authHeaderName ?? "x-bidmesh-auth"
  };
}

function readAuthToken(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

async function handleCounter(
  state: SellerState,
  policy: SellerPolicy,
  request: VerifiedEnvelope<CounterRequest>,
  fingerprint: string,
  options: NormalizedOptions
) {
  const deal = state.deals.get(request.body.deal_id);
  if (!deal) {
    return failureResponse(request.body.deal_id, "validation_denied");
  }

  const invalidReason = invalidFollowUpReason(
    deal,
    request.from_pubkey,
    request.to_pubkey,
    options.sellerPubkey,
    request.round
  );
  if (invalidReason || deal.phase !== "countering") {
    await blockExistingDeal({
      state,
      deal,
      auditLogPath: options.auditLogPath,
      counterpartyPubkey: request.from_pubkey,
      floor: policy.min_price,
      reason: invalidReason ?? "validation_denied",
      method: request.method,
      requestRound: request.round,
      attemptedPrice: request.body.price,
      terms: request.body.terms,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      requestFingerprint: fingerprint,
      closeDeal: false,
      now: options.now
    });
    return failureResponse(deal.deal_id, invalidReason ?? "validation_denied");
  }

  const validation = validateSellerAction(
    {
      type: "counter",
      quantity: deal.quantity,
      currency: request.body.currency,
      offered_price: request.body.price
    },
    {
      ...policy,
      inventory_available: state.availableInventory
    }
  );

  if (!validation.allow) {
    await blockExistingDeal({
      state,
      deal,
      auditLogPath: options.auditLogPath,
      counterpartyPubkey: request.from_pubkey,
      floor: policy.min_price,
      reason: validation.reason as DealReasonCode,
      method: request.method,
      requestRound: request.round,
      attemptedPrice: request.body.price,
      terms: request.body.terms,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      requestFingerprint: fingerprint,
      closeDeal: false,
      now: options.now
    });
    return failureResponse(deal.deal_id, validation.reason as DealReasonCode);
  }

  const sellerRound = deal.round + 1;
  const decision = decideSellerMove({
    buyerPrice: request.body.price,
    listPrice: policy.list_price,
    minPrice: policy.min_price,
    round: sellerRound,
    maxRounds: policy.max_rounds
  });

  deal.round = sellerRound;

  if (decision === "accept") {
    const phaseBefore = deal.phase;
    deal.current_price = request.body.price;
    deal.seller_terms = request.body.terms ?? deal.seller_terms ?? policy.fulfillment_terms;
    deal.updated_at = options.now();

    await logAuditEvent({
      auditLogPath: options.auditLogPath,
      dealId: deal.deal_id,
      counterpartyPubkey: request.from_pubkey,
      action: "seller_accepted_offer",
      method: request.method,
      requestRound: request.round,
      phaseBefore,
      phaseAfter: deal.phase,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      quantity: deal.quantity,
      attemptedPrice: request.body.price,
      terms: deal.seller_terms,
      floor: policy.min_price,
      allowed: true,
      requestFingerprint: fingerprint,
      now: options.now
    });

    return {
      deal_id: deal.deal_id,
      accepted: true
    };
  }

  if (decision === "walk") {
    const phaseBefore = deal.phase;
    deal.phase = "walked";
    deal.reason_code = "price_too_low";
    deal.updated_at = options.now();

    await logAuditEvent({
      auditLogPath: options.auditLogPath,
      dealId: deal.deal_id,
      counterpartyPubkey: request.from_pubkey,
      action: "walk",
      method: request.method,
      requestRound: request.round,
      phaseBefore,
      phaseAfter: deal.phase,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      quantity: deal.quantity,
      attemptedPrice: request.body.price,
      terms: request.body.terms,
      floor: policy.min_price,
      allowed: true,
      reason: "price_too_low",
      requestFingerprint: fingerprint,
      now: options.now
    });

    return failureResponse(deal.deal_id, "price_too_low");
  }

  const phaseBefore = deal.phase;
  const counterPrice = nextSellerCounter({
    listPrice: policy.list_price,
    minPrice: policy.min_price,
    round: sellerRound,
    maxRounds: policy.max_rounds
  });

  deal.current_price = counterPrice;
  deal.updated_at = options.now();

  await logAuditEvent({
    auditLogPath: options.auditLogPath,
    dealId: deal.deal_id,
    counterpartyPubkey: request.from_pubkey,
    action: "seller_countered",
    method: request.method,
    requestRound: request.round,
    phaseBefore,
    phaseAfter: deal.phase,
    fromPubkey: request.from_pubkey,
    toPubkey: request.to_pubkey,
    envelopeTimestamp: request.timestamp,
    envelopeExpiresAt: request.expires_at,
    quantity: deal.quantity,
    attemptedPrice: counterPrice,
    terms: deal.seller_terms,
    floor: policy.min_price,
    allowed: true,
    requestFingerprint: fingerprint,
    now: options.now
  });

  return {
    deal_id: deal.deal_id,
    accepted: false,
    counter_price: counterPrice,
    terms: deal.seller_terms
  };
}

async function handleAccept(
  state: SellerState,
  policy: SellerPolicy,
  request: VerifiedEnvelope<AcceptRequest>,
  fingerprint: string,
  options: NormalizedOptions
) {
  const deal = state.deals.get(request.body.deal_id);
  if (!deal) {
    return failureResponse(request.body.deal_id, "validation_denied");
  }

  const invalidReason = invalidFollowUpReason(
    deal,
    request.from_pubkey,
    request.to_pubkey,
    options.sellerPubkey,
    request.round
  );
  const termsMismatch = request.body.terms !== deal.seller_terms;
  const priceMismatch = request.body.accepted_price !== deal.current_price;

  if (invalidReason || deal.phase !== "countering" || termsMismatch || priceMismatch) {
    await blockExistingDeal({
      state,
      deal,
      auditLogPath: options.auditLogPath,
      counterpartyPubkey: request.from_pubkey,
      floor: 0,
      reason: "validation_denied",
      method: request.method,
      requestRound: request.round,
      attemptedPrice: request.body.accepted_price,
      terms: request.body.terms,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      requestFingerprint: fingerprint,
      closeDeal: false,
      now: options.now
    });
    return failureResponse(deal.deal_id, "validation_denied");
  }

  if (state.availableInventory < deal.quantity) {
    await blockExistingDeal({
      state,
      deal,
      auditLogPath: options.auditLogPath,
      counterpartyPubkey: request.from_pubkey,
      floor: policy.min_price,
      reason: "inventory_unavailable",
      method: request.method,
      requestRound: request.round,
      attemptedPrice: request.body.accepted_price,
      terms: request.body.terms,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      requestFingerprint: fingerprint,
      closeDeal: false,
      now: options.now
    });
    return failureResponse(deal.deal_id, "inventory_unavailable");
  }

  const validation = validateSellerAction(
    {
      type: "accept",
      quantity: deal.quantity,
      currency: request.body.currency,
      accepted_price: request.body.accepted_price
    },
    {
      ...policy,
      inventory_available: state.availableInventory
    }
  );

  if (!validation.allow) {
    await blockExistingDeal({
      state,
      deal,
      auditLogPath: options.auditLogPath,
      counterpartyPubkey: request.from_pubkey,
      floor: policy.min_price,
      reason: validation.reason as DealReasonCode,
      method: request.method,
      requestRound: request.round,
      attemptedPrice: request.body.accepted_price,
      terms: request.body.terms,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      requestFingerprint: fingerprint,
      closeDeal: false,
      now: options.now
    });
    return failureResponse(deal.deal_id, validation.reason as DealReasonCode);
  }

  if (deal.buyer_deadline) {
    const nowMs = canonicalizeTimestamp(options.now());
    const deadlineMs = canonicalizeTimestamp(deal.buyer_deadline);
    if (!Number.isNaN(deadlineMs) && nowMs > deadlineMs) {
      await blockExistingDeal({
        state,
        deal,
        auditLogPath: options.auditLogPath,
        counterpartyPubkey: request.from_pubkey,
        floor: policy.min_price,
        reason: "deadline_mismatch",
        method: request.method,
        requestRound: request.round,
        attemptedPrice: request.body.accepted_price,
        terms: request.body.terms,
        fromPubkey: request.from_pubkey,
        toPubkey: request.to_pubkey,
        envelopeTimestamp: request.timestamp,
        envelopeExpiresAt: request.expires_at,
        requestFingerprint: fingerprint,
        closeDeal: false,
        now: options.now
      });
      return failureResponse(deal.deal_id, "deadline_mismatch");
    }
  }

  state.availableInventory -= deal.quantity;

  const phaseBefore = deal.phase;
  const acceptedAt = options.now();
  const paymentRequired = {
    network: "base-sepolia" as const,
    asset: "USDC" as const,
    amount: request.body.accepted_price,
    pay_to: options.sellerPubkey,
    expires_at: addMinutes(acceptedAt, 10)
  };

  deal.phase = "accepted";
  deal.round = deal.round + 1;
  deal.settlement_url = `/settle/${deal.deal_id}`;
  deal.payment_required = paymentRequired;
  deal.updated_at = acceptedAt;

  await logAuditEvent({
    auditLogPath: options.auditLogPath,
    dealId: deal.deal_id,
    counterpartyPubkey: request.from_pubkey,
    action: "buyer_accepted_quote",
    method: request.method,
    requestRound: request.round,
    phaseBefore,
    phaseAfter: deal.phase,
    fromPubkey: request.from_pubkey,
    toPubkey: request.to_pubkey,
    envelopeTimestamp: request.timestamp,
    envelopeExpiresAt: request.expires_at,
    quantity: deal.quantity,
    attemptedPrice: request.body.accepted_price,
    terms: request.body.terms,
    floor: policy.min_price,
    allowed: true,
    requestFingerprint: fingerprint,
    now: options.now
  });

  return {
    deal_id: deal.deal_id,
    accepted: true,
    settlement_url: deal.settlement_url,
    payment_required: paymentRequired
  };
}

async function handleWalk(
  state: SellerState,
  policy: SellerPolicy,
  request: VerifiedEnvelope<WalkRequest>,
  fingerprint: string,
  options: NormalizedOptions
) {
  const deal = state.deals.get(request.body.deal_id);
  if (!deal) {
    return {
      deal_id: request.body.deal_id,
      closed: true
    };
  }

  const invalidReason = invalidFollowUpReason(
    deal,
    request.from_pubkey,
    request.to_pubkey,
    options.sellerPubkey,
    request.round
  );
  if (invalidReason) {
    await blockExistingDeal({
      state,
      deal,
      auditLogPath: options.auditLogPath,
      counterpartyPubkey: request.from_pubkey,
      floor: policy.min_price,
      reason: invalidReason,
      method: request.method,
      requestRound: request.round,
      terms: request.body.note,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      requestFingerprint: fingerprint,
      closeDeal: false,
      now: options.now
    });
    return {
      deal_id: deal.deal_id,
      closed: true
    };
  }

  const phaseBefore = deal.phase;
  releaseReservation(state, deal);
  deal.phase = "walked";
  deal.round = deal.round + 1;
  deal.reason_code = request.body.reason_code;
  deal.updated_at = options.now();

  await logAuditEvent({
    auditLogPath: options.auditLogPath,
    dealId: deal.deal_id,
    counterpartyPubkey: request.from_pubkey,
    action: "walk",
    method: request.method,
    requestRound: request.round,
    phaseBefore,
    phaseAfter: deal.phase,
    fromPubkey: request.from_pubkey,
    toPubkey: request.to_pubkey,
    envelopeTimestamp: request.timestamp,
    envelopeExpiresAt: request.expires_at,
    quantity: deal.quantity,
    attemptedPrice: deal.current_price,
    terms: request.body.note,
    floor: policy.min_price,
    allowed: true,
    reason: request.body.reason_code,
    requestFingerprint: fingerprint,
    now: options.now
  });

  return {
    deal_id: deal.deal_id,
    closed: true
  };
}

async function handleStatus(
  state: SellerState,
  request: VerifiedEnvelope<{ deal_id: string }>,
  fingerprint: string,
  options: NormalizedOptions
): Promise<StatusResponse> {
  const deal = state.deals.get(request.body.deal_id);
  if (!deal) {
    return {
      deal_id: request.body.deal_id,
      phase: "walked",
      round: 0,
      updated_at: options.now()
    };
  }

  if (deal.buyer_pubkey !== request.from_pubkey || request.to_pubkey !== options.sellerPubkey) {
    await blockExistingDeal({
      state,
      deal,
      auditLogPath: options.auditLogPath,
      counterpartyPubkey: request.from_pubkey,
      floor: 0,
      reason: "validation_denied",
      method: request.method,
      requestRound: request.round,
      fromPubkey: request.from_pubkey,
      toPubkey: request.to_pubkey,
      envelopeTimestamp: request.timestamp,
      envelopeExpiresAt: request.expires_at,
      requestFingerprint: fingerprint,
      closeDeal: false,
      now: options.now
    });
    throw new Error("validation_denied");
  }

  return {
    deal_id: deal.deal_id,
    phase: deal.phase,
    current_price: deal.current_price,
    round: deal.round,
    updated_at: deal.updated_at
  };
}
