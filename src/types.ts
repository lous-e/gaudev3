export type Currency = "USDC";
export type Network = "base-sepolia";
export type RpcMethod =
  | "bidmesh.negotiate.open"
  | "bidmesh.negotiate.counter"
  | "bidmesh.negotiate.accept"
  | "bidmesh.negotiate.walk"
  | "bidmesh.negotiate.status";

export type ValidationResult =
  | { allow: true }
  | { allow: false; reason: string };

export type DealPhase =
  | "open"
  | "countering"
  | "accepted"
  | "settling"
  | "settled"
  | "walked";

export type BuyerIntent = {
  item: string;
  quantity: number;
  must_have: Record<string, string | number | boolean>;
  nice_to_have?: Record<string, string | number | boolean>;
  max_price: number;
  target_price?: number;
  currency: Currency;
  deadline?: string;
  delivery_requirement?: string;
  negotiation_style: "fast" | "balanced" | "patient";
  max_rounds: number;
  allow_partial_match: boolean;
  require_human_confirmation_above?: number;
  require_human_confirmation_before_payment: boolean;
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
  negotiation_style: "firm" | "balanced" | "eager";
  max_rounds: number;
  reservation_deadline?: string;
  require_human_confirmation_below?: number;
};

export type BuyerStrategy = {
  opening_offer: number;
  preferred_price: number;
  concession_schedule: "linear" | "split_difference" | "slow_then_fast";
  walkaway_after_rounds: number;
};

export type SellerStrategy = {
  opening_ask: number;
  preferred_price: number;
  floor_price: number;
  concession_schedule: "linear" | "split_difference" | "firm";
};

export type NuffEnvelope<TBody> = {
  protocol: "nuff/v1";
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
  constraints: Record<string, string | number | boolean>;
  initial_offer: number;
  currency: Currency;
  deadline?: string;
};

export type OpenResponse = {
  deal_id: string;
  accepted: boolean;
  price?: number;
  counter_price?: number;
  terms?: string;
  reason_code?: string;
};

export type CounterRequest = {
  deal_id: string;
  price: number;
  currency: Currency;
  terms?: string;
};

export type CounterResponse = {
  deal_id: string;
  accepted: boolean;
  counter_price?: number;
  terms?: string;
  reason_code?: string;
};

export type AcceptRequest = {
  deal_id: string;
  accepted_price: number;
  currency: Currency;
  terms: string;
};

export type AcceptResponse = {
  deal_id: string;
  accepted: true;
  settlement_url: string;
  payment_required: {
    network: Network;
    asset: "USDC";
    amount: number;
    pay_to: string;
    expires_at: string;
  };
};

export type WalkRequest = {
  deal_id: string;
  reason_code:
    | "price_too_high"
    | "price_too_low"
    | "deadline_mismatch"
    | "inventory_unavailable"
    | "round_limit"
    | "human_confirmation_required"
    | "validation_denied";
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

export type Deal = {
  deal_id: string;
  phase: DealPhase;
  round: number;
  current_price?: number;
  buyer_pubkey: string;
  seller_pubkey: string;
  item: string;
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
  action: "open_received" | "counter" | "accept" | "walk" | "blocked" | "settled";
  attempted_price?: number;
  floor: number;
  allowed: boolean;
  reason?: string;
};
