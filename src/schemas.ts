import { z } from "zod";
import type {
  AcceptRequest,
  AcceptResponse,
  BuyerAuditEntry,
  BuyerIntent,
  BuyerStrategy,
  CounterRequest,
  CounterResponse,
  Deal,
  DealPhase,
  OpenRequest,
  OpenResponse,
  PaymentRequired,
  RpcMethod,
  SellerAuditEntry,
  SellerPolicy,
  SellerStrategy,
  SettleRequest,
  SettlementResponse,
  StatusRequest,
  StatusResponse,
  WalkRequest,
  WalkResponse
} from "./types";

const nonNegativeNumber = z.number().finite().nonnegative();
const positiveNumber = z.number().finite().positive();
const isoDateTime = z.iso.datetime();
const constraintValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const protocolSchema = z.literal("nuff/v1");
export const rpcMethodSchema = z.enum([
  "bidmesh.negotiate.open",
  "bidmesh.negotiate.counter",
  "bidmesh.negotiate.accept",
  "bidmesh.negotiate.walk",
  "bidmesh.negotiate.status"
]) satisfies z.ZodType<RpcMethod>;
export const currencySchema = z.literal("USDC");
export const mvpCurrencySchema = z.literal("USDC");
export const networkSchema = z.literal("base-sepolia");
export const dealPhaseSchema = z.enum([
  "open",
  "countering",
  "accepted",
  "settling",
  "settled",
  "walked"
]) satisfies z.ZodType<DealPhase>;

export const walkReasonCodeSchema = z.enum([
  "price_too_high",
  "price_too_low",
  "deadline_mismatch",
  "inventory_unavailable",
  "round_limit",
  "human_confirmation_required",
  "validation_denied"
]);

export const dealReasonCodeSchema = z.enum([
  "price_too_high",
  "price_too_low",
  "deadline_mismatch",
  "inventory_unavailable",
  "round_limit",
  "human_confirmation_required",
  "validation_denied",
  "currency_unsupported",
  "below_min_price",
  "accepted_price_exceeds_max_price",
  "opening_offer_exceeds_max_price",
  "counter_offer_exceeds_max_price",
  "settlement_amount_mismatch",
  "human_confirmation_missing",
  "reservation_expired",
  "invalid_quantity",
  "replay_detected"
]);

export const buyerIntentSchema = z.object({
  item: z.string().min(1),
  quantity: positiveNumber,
  must_have: z.record(z.string(), constraintValueSchema),
  nice_to_have: z.record(z.string(), constraintValueSchema).optional(),
  max_price: positiveNumber,
  target_price: positiveNumber.optional(),
  currency: currencySchema,
  deadline: isoDateTime.optional(),
  delivery_requirement: z.string().min(1).optional(),
  negotiation_style: z.enum(["fast", "balanced", "patient"]),
  max_rounds: z.number().int().positive(),
  allow_partial_match: z.boolean(),
  require_human_confirmation_above: nonNegativeNumber.optional(),
  require_human_confirmation_before_payment: z.boolean()
})
  .strict()
  .refine(
    (value) => value.target_price === undefined || value.target_price <= value.max_price,
    {
      message: "target_price must be less than or equal to max_price",
      path: ["target_price"]
    }
  ) satisfies z.ZodType<BuyerIntent>;

export const buyerStrategySchema = z.object({
  opening_offer: nonNegativeNumber,
  preferred_price: nonNegativeNumber,
  concession_schedule: z.enum(["linear", "split_difference", "slow_then_fast"]),
  walkaway_after_rounds: z.number().int().positive()
}).strict() satisfies z.ZodType<BuyerStrategy>;

export const sellerPolicySchema = z.object({
  item_id: z.string().min(1),
  item_name: z.string().min(1),
  inventory_available: z.number().int().nonnegative(),
  list_price: positiveNumber,
  min_price: positiveNumber,
  currency: currencySchema,
  fulfillment_terms: z.string().min(1),
  delivery_estimate: z.string().min(1).optional(),
  negotiation_style: z.enum(["firm", "balanced", "eager"]),
  max_rounds: z.number().int().positive(),
  reservation_deadline: isoDateTime.optional(),
  require_human_confirmation_below: nonNegativeNumber.optional()
}).strict()
  .refine((value) => value.list_price >= value.min_price, {
    message: "list_price must be greater than or equal to min_price",
    path: ["list_price"]
  }) satisfies z.ZodType<SellerPolicy>;

export const sellerStrategySchema = z.object({
  opening_ask: nonNegativeNumber,
  preferred_price: nonNegativeNumber,
  floor_price: nonNegativeNumber,
  concession_schedule: z.enum(["linear", "split_difference", "firm"])
}).strict() satisfies z.ZodType<SellerStrategy>;

const rpcEnvelopeCommonSchema = z.object({
  protocol: protocolSchema,
  from_pubkey: z.string().min(1),
  to_pubkey: z.string().min(1),
  round: z.number().int().nonnegative(),
  timestamp: isoDateTime,
  expires_at: isoDateTime.optional(),
  signature: z.literal("mock")
}).strict();

export const openRequestSchema = z.object({
  intent_summary: z.string().min(1),
  item: z.string().min(1),
  quantity: positiveNumber,
  constraints: z.record(z.string(), constraintValueSchema),
  initial_offer: positiveNumber,
  currency: mvpCurrencySchema,
  deadline: isoDateTime.optional()
}).strict() satisfies z.ZodType<OpenRequest>;

export const openResponseSchema = z.discriminatedUnion("accepted", [
  z.object({
    deal_id: z.string().min(1),
    accepted: z.literal(true),
    price: positiveNumber,
    terms: z.string().min(1).optional()
  }).strict(),
  z
    .object({
      deal_id: z.string().min(1),
      accepted: z.literal(false),
      counter_price: positiveNumber.optional(),
      terms: z.string().min(1).optional(),
      reason_code: dealReasonCodeSchema.optional()
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.counter_price === undefined && value.reason_code === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "rejected responses require counter_price or reason_code",
          path: ["counter_price"]
        });
      }
    })
]) satisfies z.ZodType<OpenResponse>;

export const counterRequestSchema = z.object({
  deal_id: z.string().min(1),
  price: positiveNumber,
  currency: mvpCurrencySchema,
  terms: z.string().min(1).optional()
}).strict() satisfies z.ZodType<CounterRequest>;

export const counterResponseSchema = z.discriminatedUnion("accepted", [
  z.object({
    deal_id: z.string().min(1),
    accepted: z.literal(true)
  }).strict(),
  z
    .object({
      deal_id: z.string().min(1),
      accepted: z.literal(false),
      counter_price: positiveNumber.optional(),
      terms: z.string().min(1).optional(),
      reason_code: dealReasonCodeSchema.optional()
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.counter_price === undefined && value.reason_code === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "rejected counter responses require counter_price or reason_code",
          path: ["counter_price"]
        });
      }
    })
]) satisfies z.ZodType<CounterResponse>;

export const paymentRequiredSchema = z.object({
  network: networkSchema,
  asset: mvpCurrencySchema,
  amount: positiveNumber,
  pay_to: z.string().min(1),
  expires_at: isoDateTime
}).strict() satisfies z.ZodType<PaymentRequired>;

export const acceptRequestSchema = z.object({
  deal_id: z.string().min(1),
  accepted_price: positiveNumber,
  currency: mvpCurrencySchema,
  terms: z.string().min(1)
}).strict() satisfies z.ZodType<AcceptRequest>;

export const acceptResponseSchema = z.object({
  deal_id: z.string().min(1),
  accepted: z.literal(true),
  settlement_url: z.string().min(1),
  payment_required: paymentRequiredSchema
}).strict() satisfies z.ZodType<AcceptResponse>;

export const walkRequestSchema = z.object({
  deal_id: z.string().min(1),
  reason_code: walkReasonCodeSchema,
  note: z.string().min(1).optional()
}).strict() satisfies z.ZodType<WalkRequest>;

export const walkResponseSchema = z.object({
  deal_id: z.string().min(1),
  closed: z.literal(true)
}).strict() satisfies z.ZodType<WalkResponse>;

export const statusRequestSchema = z.object({
  deal_id: z.string().min(1)
}).strict() satisfies z.ZodType<StatusRequest>;

export const statusResponseSchema = z.object({
  deal_id: z.string().min(1),
  phase: dealPhaseSchema,
  current_price: positiveNumber.optional(),
  round: z.number().int().nonnegative(),
  updated_at: isoDateTime
}).strict() satisfies z.ZodType<StatusResponse>;

export const dealSchema = z.object({
  deal_id: z.string().min(1),
  protocol: protocolSchema,
  buyer_pubkey: z.string().min(1),
  seller_pubkey: z.string().min(1),
  intent_summary: z.string().min(1),
  item: z.string().min(1),
  quantity: positiveNumber,
  currency: mvpCurrencySchema,
  buyer_constraints: z.record(z.string(), constraintValueSchema),
  buyer_deadline: isoDateTime.optional(),
  phase: dealPhaseSchema,
  round: z.number().int().nonnegative(),
  current_price: positiveNumber.optional(),
  seller_terms: z.string().min(1).optional(),
  reason_code: dealReasonCodeSchema.optional(),
  settlement_url: z.string().min(1).optional(),
  payment_required: paymentRequiredSchema.optional(),
  request_fingerprint: z.string().min(1).optional(),
  tx_hash: z.string().min(1).optional(),
  proof_artifact: z
    .object({
      type: z.literal("mock-receipt"),
      reference: z.string().min(1),
      delivered_at: isoDateTime
    })
    .optional(),
  created_at: isoDateTime,
  updated_at: isoDateTime
}).strict() satisfies z.ZodType<Deal>;

export const buyerAuditEntrySchema = z.object({
  timestamp: isoDateTime,
  session_id: z.string().min(1),
  deal_id: z.string().min(1),
  counterparty_pubkey: z.string().min(1),
  action: z.enum(["open", "counter", "accept", "walk", "settle", "blocked"]),
  attempted_price: nonNegativeNumber.optional(),
  accepted_price: nonNegativeNumber.optional(),
  cap: nonNegativeNumber,
  allowed: z.boolean(),
  reason: z.string().min(1).optional()
}).strict() satisfies z.ZodType<BuyerAuditEntry>;

export const sellerAuditEntrySchema = z.object({
  timestamp: isoDateTime,
  deal_id: z.string().min(1),
  counterparty_pubkey: z.string().min(1),
  action: z.enum([
    "open_received",
    "seller_accepted_offer",
    "seller_countered",
    "buyer_accepted_quote",
    "walk",
    "blocked",
    "settled"
  ]),
  method: z.enum([
    "bidmesh.negotiate.open",
    "bidmesh.negotiate.counter",
    "bidmesh.negotiate.accept",
    "bidmesh.negotiate.walk",
    "bidmesh.negotiate.status",
    "settle"
  ]),
  request_round: z.number().int().nonnegative().optional(),
  phase_before: z.union([dealPhaseSchema, z.literal("none")]).optional(),
  phase_after: dealPhaseSchema.optional(),
  from_pubkey: z.string().min(1).optional(),
  to_pubkey: z.string().min(1).optional(),
  envelope_timestamp: isoDateTime.optional(),
  envelope_expires_at: isoDateTime.optional(),
  quantity: positiveNumber.optional(),
  attempted_price: nonNegativeNumber.optional(),
  terms: z.string().min(1).optional(),
  floor: nonNegativeNumber,
  allowed: z.boolean(),
  reason: z.string().min(1).optional(),
  request_fingerprint: z.string().min(1).optional()
}).strict() satisfies z.ZodType<SellerAuditEntry>;

export const settleRequestSchema = z.object({
  accepted_price: positiveNumber,
  currency: mvpCurrencySchema,
  buyer_pubkey: z.string().min(1),
  human_confirmation: z.boolean()
}).strict() satisfies z.ZodType<SettleRequest>;

export const settlementResponseSchema = z.object({
  deal_id: z.string().min(1),
  settled: z.literal(true),
  tx_hash: z.string().min(1),
  proof_artifact: z
    .object({
      type: z.literal("mock-receipt"),
      reference: z.string().min(1),
      delivered_at: isoDateTime
    })
    .strict()
}).strict() satisfies z.ZodType<SettlementResponse>;

const openRpcRequestSchemaBase = rpcEnvelopeCommonSchema.extend({
  method: z.literal("bidmesh.negotiate.open"),
  deal_id: z.undefined().optional(),
  body: openRequestSchema
});

const counterRpcRequestSchemaBase = rpcEnvelopeCommonSchema.extend({
  method: z.literal("bidmesh.negotiate.counter"),
  deal_id: z.string().min(1),
  body: counterRequestSchema
});

const acceptRpcRequestSchemaBase = rpcEnvelopeCommonSchema.extend({
  method: z.literal("bidmesh.negotiate.accept"),
  deal_id: z.string().min(1),
  body: acceptRequestSchema
});

const walkRpcRequestSchemaBase = rpcEnvelopeCommonSchema.extend({
  method: z.literal("bidmesh.negotiate.walk"),
  deal_id: z.string().min(1),
  body: walkRequestSchema
});

const statusRpcRequestSchemaBase = rpcEnvelopeCommonSchema.extend({
  method: z.literal("bidmesh.negotiate.status"),
  deal_id: z.string().min(1),
  body: statusRequestSchema
});

function withMatchingDealId<
  T extends z.ZodObject<{
    deal_id: z.ZodString;
    body: z.ZodObject<{ deal_id: z.ZodString }>;
  }>
>(schema: T) {
  return schema.superRefine((value, ctx) => {
    if (value.deal_id !== value.body.deal_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "envelope deal_id must match body deal_id",
        path: ["body", "deal_id"]
      });
    }
  });
}

export const openRpcRequestSchema = openRpcRequestSchemaBase;
export const counterRpcRequestSchema = withMatchingDealId(counterRpcRequestSchemaBase);
export const acceptRpcRequestSchema = withMatchingDealId(acceptRpcRequestSchemaBase);
export const walkRpcRequestSchema = withMatchingDealId(walkRpcRequestSchemaBase);
export const statusRpcRequestSchema = withMatchingDealId(statusRpcRequestSchemaBase);

export const rpcRequestUnionSchema = z.discriminatedUnion("method", [
  openRpcRequestSchema,
  counterRpcRequestSchema,
  acceptRpcRequestSchema,
  walkRpcRequestSchema,
  statusRpcRequestSchema
]);
