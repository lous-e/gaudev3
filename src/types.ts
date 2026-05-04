export type Currency = "USDC";
export type MvpCurrency = "USDC";
export type MockNetwork = "base-sepolia";
export type Protocol = "nuff/v1";

export type RpcMethod =
  | "bidmesh.negotiate.open"
  | "bidmesh.negotiate.counter"
  | "bidmesh.negotiate.accept"
  | "bidmesh.negotiate.walk"
  | "bidmesh.negotiate.status";

export type ValidationResult =
  | { allow: true }
  | { allow: false; reason: string };

export type BuyerAction =
  | { type: "open"; price: number }
  | { type: "counter"; price: number }
  | { type: "accept"; price: number }
  | { type: "settle"; amount: number; accepted_price: number; human_confirmation: boolean };

export type SellerValidationAction =
  | { type: "open"; quantity: number; currency: Currency; offered_price: number }
  | { type: "counter"; quantity: number; currency: Currency; offered_price: number }
  | { type: "accept"; quantity: number; currency: Currency; accepted_price: number }
  | { type: "settle"; quantity: number; currency: Currency; accepted_price: number; now?: string };

export type DealPhase =
  | "open"
  | "countering"
  | "accepted"
  | "settling"
  | "settled"
  | "walked";

export type NegotiationStyle = "fast" | "balanced" | "patient";
export type SellerNegotiationStyle = "firm" | "balanced" | "eager";
export type ConcessionSchedule =
  | "linear"
  | "split_difference"
  | "slow_then_fast";
export type SellerConcessionSchedule =
  | "linear"
  | "split_difference"
  | "firm";

export type ConstraintValue = string | number | boolean;

export type BuyerIntent = {
  item: string;
  quantity: number;
  must_have: Record<string, ConstraintValue>;
  nice_to_have?: Record<string, ConstraintValue>;
  max_price: number;
  target_price?: number;
  currency: Currency;
  deadline?: string;
  delivery_requirement?: string;
  negotiation_style: NegotiationStyle;
  max_rounds: number;
  allow_partial_match: boolean;
  require_human_confirmation_above?: number;
  require_human_confirmation_before_payment: boolean;
};

export type BuyerStrategy = {
  opening_offer: number;
  preferred_price: number;
  concession_schedule: ConcessionSchedule;
  walkaway_after_rounds: number;
};

export type SellerPolicy = {
  item_id: string;
  item_name: string;
  inventory_available: number;
  list_price: number;
  min_price: number;
  currency: Currency;
  fulfillment_terms: string;
  delivery_estimate?: string;
  negotiation_style: SellerNegotiationStyle;
  max_rounds: number;
  reservation_deadline?: string;
  require_human_confirmation_below?: number;
};

export type SellerStrategy = {
  opening_ask: number;
  preferred_price: number;
  floor_price: number;
  concession_schedule: SellerConcessionSchedule;
};

export type RpcRequest<TBody> = {
  protocol: Protocol;
  method: RpcMethod;
  deal_id?: string;
  from_pubkey: string;
  to_pubkey: string;
  round: number;
  timestamp: string;
  expires_at?: string;
  signature: "mock";
  body: TBody;
};

export type NuffEnvelope<TBody> = {
  protocol: Protocol;
  deal_id: string;
  from_pubkey: string;
  to_pubkey: string;
  round: number;
  timestamp: string;
  expires_at?: string;
  signature: string;
  body: TBody;
};

export type OpenRequest = {
  intent_summary: string;
  item: string;
  quantity: number;
  constraints: Record<string, ConstraintValue>;
  initial_offer: number;
  currency: MvpCurrency;
  deadline?: string;
};

export type OpenResponse =
  | {
      deal_id: string;
      accepted: true;
      price: number;
      terms?: string;
    }
  | {
      deal_id: string;
      accepted: false;
      counter_price?: number;
      terms?: string;
      reason_code?: DealReasonCode;
    };

export type CounterRequest = {
  deal_id: string;
  price: number;
  currency: MvpCurrency;
  terms?: string;
};

export type CounterResponse =
  | {
      deal_id: string;
      accepted: true;
    }
  | {
      deal_id: string;
      accepted: false;
      counter_price?: number;
      terms?: string;
      reason_code?: DealReasonCode;
    };

export type AcceptRequest = {
  deal_id: string;
  accepted_price: number;
  currency: MvpCurrency;
  terms: string;
};

export type PaymentRequired = {
  network: MockNetwork;
  asset: MvpCurrency;
  amount: number;
  pay_to: string;
  expires_at: string;
};

export type AcceptResponse = {
  deal_id: string;
  accepted: true;
  settlement_url: string;
  payment_required: PaymentRequired;
};

export type WalkReasonCode =
  | "price_too_high"
  | "price_too_low"
  | "deadline_mismatch"
  | "inventory_unavailable"
  | "round_limit"
  | "human_confirmation_required"
  | "validation_denied";

export type WalkRequest = {
  deal_id: string;
  reason_code: WalkReasonCode;
  note?: string;
};

export type WalkResponse = {
  deal_id: string;
  closed: true;
};

export type StatusRequest = {
  deal_id: string;
};

export type StatusResponse = {
  deal_id: string;
  phase: DealPhase;
  current_price?: number;
  round: number;
  updated_at: string;
};

export type DealReasonCode =
  | WalkReasonCode
  | "currency_unsupported"
  | "below_min_price"
  | "accepted_price_exceeds_max_price"
  | "opening_offer_exceeds_max_price"
  | "counter_offer_exceeds_max_price"
  | "settlement_amount_mismatch"
  | "human_confirmation_missing"
  | "reservation_expired"
  | "invalid_quantity"
  | "replay_detected";

export type Deal = {
  deal_id: string;
  protocol: Protocol;
  buyer_pubkey: string;
  seller_pubkey: string;
  intent_summary: string;
  item: string;
  quantity: number;
  currency: MvpCurrency;
  buyer_constraints: Record<string, ConstraintValue>;
  buyer_deadline?: string;
  phase: DealPhase;
  round: number;
  current_price?: number;
  seller_terms?: string;
  reason_code?: DealReasonCode;
  settlement_url?: string;
  payment_required?: PaymentRequired;
  request_fingerprint?: string;
  tx_hash?: string;
  proof_artifact?: {
    type: "mock-receipt";
    reference: string;
    delivered_at: string;
  };
  created_at: string;
  updated_at: string;
};

export type BuyerAuditEntry = {
  timestamp: string;
  session_id: string;
  deal_id: string;
  counterparty_pubkey: string;
  action: "open" | "counter" | "accept" | "walk" | "settle" | "blocked";
  attempted_price?: number;
  accepted_price?: number;
  cap: number;
  allowed: boolean;
  reason?: string;
};

export type SellerAuditEntry = {
  timestamp: string;
  deal_id: string;
  counterparty_pubkey: string;
  action:
    | "open_received"
    | "seller_accepted_offer"
    | "seller_countered"
    | "buyer_accepted_quote"
    | "walk"
    | "blocked"
    | "settled";
  method:
    | "bidmesh.negotiate.open"
    | "bidmesh.negotiate.counter"
    | "bidmesh.negotiate.accept"
    | "bidmesh.negotiate.walk"
    | "bidmesh.negotiate.status"
    | "settle";
  request_round?: number;
  phase_before?: DealPhase | "none";
  phase_after?: DealPhase;
  from_pubkey?: string;
  to_pubkey?: string;
  envelope_timestamp?: string;
  envelope_expires_at?: string;
  quantity?: number;
  attempted_price?: number;
  terms?: string;
  floor: number;
  allowed: boolean;
  reason?: string;
  request_fingerprint?: string;
};

export type SettleRequest = {
  accepted_price: number;
  currency: MvpCurrency;
  buyer_pubkey: string;
  human_confirmation: boolean;
};

export type SettlementResponse = {
  deal_id: string;
  settled: true;
  tx_hash: string;
  proof_artifact: NonNullable<Deal["proof_artifact"]>;
};

export type NegotiationMove = "accept" | "counter" | "walk";

export type SignedRpcEnvelope = RpcRequest<
  OpenRequest | CounterRequest | AcceptRequest | WalkRequest | StatusRequest
>;
