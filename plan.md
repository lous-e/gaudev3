# BidMesh Negotiation Protocol Plan

## Purpose

BidMesh lets two human-aligned agents negotiate a purchase without either agent receiving open-ended spending authority. Humans provide policy parameters. Agents choose tactics inside those limits. Deterministic validation shims enforce the limits before any offer, acceptance, or payment leaves the agent runtime.

The MVP protocol is single-issue negotiation over price. Delivery, warranty, substitutions, reputation, and bundles can be represented as terms, but they are not negotiated independently in v1.

## Core Principle

An agent may choose tactics, but it may not alter authority.

The LLM can decide whether to offer, counter, accept, wait, or walk. It cannot raise the buyer's maximum price, lower the seller's minimum price, skip required confirmation, or initiate settlement outside the human-approved policy.

## Human Inputs

### Buyer Intent Parameters

These are provided by the buyer's human, either explicitly or extracted from natural language and confirmed before negotiation begins.

```ts
type BuyerIntent = {
  item: string;
  quantity: number;
  must_have: Record<string, string | number | boolean>;
  nice_to_have?: Record<string, string | number | boolean>;

  max_price: number;
  target_price?: number;
  currency: "USD" | "USDC";

  deadline?: string;
  delivery_requirement?: string;

  negotiation_style: "fast" | "balanced" | "patient";
  max_rounds: number;
  allow_partial_match: boolean;

  require_human_confirmation_above?: number;
  require_human_confirmation_before_payment: boolean;
};
```

Required for MVP:

- `item`
- `quantity`
- `max_price`
- `currency`
- `max_rounds`
- `require_human_confirmation_before_payment`

Recommended defaults:

```ts
const defaultBuyerIntent = {
  quantity: 1,
  currency: "USDC",
  negotiation_style: "balanced",
  max_rounds: 3,
  allow_partial_match: false,
  require_human_confirmation_before_payment: true
};
```

### Seller Policy Parameters

These are provided by the seller's human or inventory configuration.

```ts
type SellerPolicy = {
  item_id: string;
  item_name: string;
  inventory_available: number;

  list_price: number;
  min_price: number;
  currency: "USD" | "USDC";

  fulfillment_terms: string;
  delivery_estimate?: string;

  negotiation_style: "firm" | "balanced" | "eager";
  max_rounds: number;

  reservation_deadline?: string;
  require_human_confirmation_below?: number;
};
```

Required for MVP:

- `item_id`
- `item_name`
- `inventory_available`
- `list_price`
- `min_price`
- `currency`
- `fulfillment_terms`
- `max_rounds`

Recommended defaults:

```ts
const defaultSellerPolicy = {
  currency: "USDC",
  negotiation_style: "balanced",
  max_rounds: 3
};
```

## Private Strategy

Private strategy fields are never sent to the counterparty. They guide the local agent's offers and counters.

### Buyer Strategy

```ts
type BuyerStrategy = {
  opening_offer: number;
  preferred_price: number;
  concession_schedule: "linear" | "split_difference" | "slow_then_fast";
  walkaway_after_rounds: number;
};
```

Suggested MVP heuristic:

- Opening offer: `min(target_price ?? max_price * 0.8, max_price)`
- Accept immediately if seller price is `<= target_price`
- Counter toward `max_price` over `max_rounds`
- Walk if the seller price remains above `max_price`

### Seller Strategy

```ts
type SellerStrategy = {
  opening_ask: number;
  preferred_price: number;
  floor_price: number;
  concession_schedule: "linear" | "split_difference" | "firm";
};
```

Suggested MVP heuristic:

- Opening ask: `list_price`
- Accept immediately if buyer offer is `>= list_price`
- Counter down toward `min_price` over `max_rounds`
- Walk if the buyer offer remains below `min_price`

## Public Protocol: NuffV1

The negotiation layer is NuffV1.

All negotiation messages are JSON-RPC over HTTPS and should be signed by the sending agent's Nostr identity.

### Message Envelope

```ts
type NuffEnvelope<TBody> = {
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
```

### Methods

#### `bidmesh.negotiate.open`

Buyer opens a negotiation with a seller.

```ts
type OpenRequest = {
  intent_summary: string;
  item: string;
  quantity: number;
  constraints: Record<string, string | number | boolean>;
  initial_offer: number;
  currency: "USDC";
  deadline?: string;
};

type OpenResponse = {
  deal_id: string;
  accepted: boolean;
  price?: number;
  counter_price?: number;
  terms?: string;
  reason_code?: string;
};
```

#### `bidmesh.negotiate.counter`

Either side proposes a new price.

```ts
type CounterRequest = {
  deal_id: string;
  price: number;
  currency: "USDC";
  terms?: string;
};

type CounterResponse = {
  deal_id: string;
  accepted: boolean;
  counter_price?: number;
  terms?: string;
  reason_code?: string;
};
```

#### `bidmesh.negotiate.accept`

One side accepts the current negotiated price. For settlement, both sides must agree on the same final price.

```ts
type AcceptRequest = {
  deal_id: string;
  accepted_price: number;
  currency: "USDC";
  terms: string;
};

type AcceptResponse = {
  deal_id: string;
  accepted: true;
  settlement_url: string;
  payment_required: {
    network: "base-sepolia";
    asset: "USDC";
    amount: number;
    pay_to: string;
    expires_at: string;
  };
};
```

#### `bidmesh.negotiate.walk`

Either side aborts the negotiation.

```ts
type WalkRequest = {
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

type WalkResponse = {
  deal_id: string;
  closed: true;
};
```

#### `bidmesh.negotiate.status`

Optional read-only method for debugging or recovery.

```ts
type StatusRequest = {
  deal_id: string;
};

type StatusResponse = {
  deal_id: string;
  phase: "open" | "countering" | "accepted" | "settling" | "settled" | "walked";
  current_price?: number;
  round: number;
  updated_at: string;
};
```

## Negotiation Flow

### Buyer Flow

1. Receive natural-language request from the human.
2. Extract `BuyerIntent`.
3. Ask the human to confirm the structured intent and spending authority.
4. Discover candidate sellers through Clawstr/Nostr.
5. Fetch and validate each seller's Agent Card.
6. Open negotiation with the best candidate sellers.
7. Evaluate seller responses against buyer policy and private strategy.
8. Accept, counter, or walk.
9. Before acceptance, run the Validation Shim.
10. Before payment, require human confirmation if policy requires it.
11. Pay through x402.
12. Record the deal and notify the human.

### Seller Flow

1. Receive `bidmesh.negotiate.open`.
2. Validate message envelope, signature, item match, inventory, and currency.
3. Evaluate buyer offer against `SellerPolicy`.
4. Accept, counter, or walk.
5. Reserve inventory when an offer is accepted.
6. Return x402 payment challenge.
7. On payment confirmation, release proof artifact.
8. Record the deal.

## MVP Tactics

### Buyer Decision Heuristic

```ts
function decideBuyerMove({
  sellerPrice,
  targetPrice,
  maxPrice,
  round,
  maxRounds
}) {
  if (sellerPrice <= targetPrice) return "accept";
  if (sellerPrice <= maxPrice && round >= maxRounds) return "accept";
  if (sellerPrice > maxPrice && round >= maxRounds) return "walk";

  return "counter";
}
```

Counter price:

```ts
nextBuyerCounter = min(
  maxPrice,
  openingOffer + ((maxPrice - openingOffer) * round) / maxRounds
);
```

### Seller Decision Heuristic

```ts
function decideSellerMove({
  buyerPrice,
  listPrice,
  minPrice,
  round,
  maxRounds
}) {
  if (buyerPrice >= listPrice) return "accept";
  if (buyerPrice >= minPrice && round >= maxRounds) return "accept";
  if (buyerPrice < minPrice && round >= maxRounds) return "walk";

  return "counter";
}
```

Counter price:

```ts
nextSellerCounter = max(
  minPrice,
  listPrice - ((listPrice - minPrice) * round) / maxRounds
);
```

## Validation Shims

### Buyer Validation Shim

The buyer shim is mandatory. It runs before every outbound A2A call and before every x402 settlement call.

Rules:

- Reject any opening offer above `BuyerIntent.max_price`.
- Reject any counter above `BuyerIntent.max_price`.
- Reject any acceptance above `BuyerIntent.max_price`.
- Reject settlement if the payment amount differs from the accepted price.
- Reject settlement if human confirmation is required and missing.
- Log every rejection to `buyer/workspace/memory/audit.log`.

Pure function:

```ts
type ValidationResult =
  | { allow: true }
  | { allow: false; reason: string };

function validateBuyerAction(action, sessionPolicy): ValidationResult {
  // No LLM calls. No natural-language parsing. Numeric checks only.
}
```

### Seller Validation Shim

The seller shim is recommended for MVP and required for production.

Rules:

- Reject any acceptance below `SellerPolicy.min_price`.
- Reject any accepted quantity above available inventory.
- Reject unsupported currencies.
- Reject expired reservations.
- Log every rejection to `seller/workspace/memory/audit.log`.

## Audit Log

Every negotiation should produce an append-only local audit trail.

Minimum buyer audit fields:

```ts
type BuyerAuditEntry = {
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
```

Minimum seller audit fields:

```ts
type SellerAuditEntry = {
  timestamp: string;
  deal_id: string;
  counterparty_pubkey: string;
  action: "open_received" | "counter" | "accept" | "walk" | "blocked" | "settled";
  attempted_price?: number;
  floor: number;
  allowed: boolean;
  reason?: string;
};
```

## Human Confirmation Rules

The buyer agent must ask for confirmation before payment in the MVP.

Recommended Telegram confirmation:

```text
Confirm purchase?

Item: USB-C cable
Seller: 0x4a3f...c0de
Final price: 4.75 USDC
Delivery: redemption code immediately

Reply /confirm to pay or /stop to cancel.
```

The agent may negotiate before confirmation only if the user has confirmed the original spending authority. It may not settle without confirmation unless `require_human_confirmation_before_payment` is explicitly false.

## Implementation Phases

### Phase 1: Types and Schemas

- Add NuffV1 method names and TypeScript types in `shared/a2a-protocol.ts`.
- Add zod validators for every public request and response.
- Add shared reason-code constants.
- Add unit tests for schema validation.

Acceptance:

- Invalid currencies are rejected.
- Missing prices are rejected.
- Unknown method names are rejected.
- Valid `open`, `counter`, `accept`, `walk`, and `status` messages parse cleanly.

### Phase 2: Buyer Policy Extraction

- Extract `BuyerIntent` from Telegram input.
- Echo structured parameters back to the human.
- Require confirmation before discovery/negotiation.
- Store confirmed policy in the active session record.

Acceptance:

- `"find me a USB-C cable under $5"` creates `max_price = 5`.
- The agent does not contact sellers before confirmation.
- The session record survives through negotiation.

### Phase 3: Seller Policy and Pricing

- Define seller inventory with `list_price`, `min_price`, and fulfillment terms.
- Implement deterministic seller pricing.
- Add seller-side validation for floor price and inventory.

Acceptance:

- Seller counters above `min_price`.
- Seller never accepts below `min_price`.
- Seller walks after `max_rounds`.

### Phase 4: A2A Negotiation Loop

- Implement `bidmesh.negotiate.open`.
- Implement `bidmesh.negotiate.counter`.
- Implement `bidmesh.negotiate.accept`.
- Implement `bidmesh.negotiate.walk`.
- Add deal state tracking by `deal_id`.

Acceptance:

- Buyer and seller can complete a deal at or below buyer cap and at or above seller floor.
- Buyer walks when seller remains above cap.
- Seller walks when buyer remains below floor.

### Phase 5: Validation Shim

- Add buyer `before_tool_call` validation.
- Block outbound bids above cap.
- Block final acceptance above cap.
- Block settlement mismatch.
- Write append-only audit entries.

Acceptance:

- With `max_price = 5`, a forced `7 USDC` acceptance is blocked.
- The blocked attempt appears in `buyer/workspace/memory/audit.log`.
- No x402 settlement is attempted after a blocked action.

### Phase 6: x402 Settlement

- Seller returns x402 payment challenge after accept.
- Buyer signs and sends payment.
- Seller verifies payment and returns proof artifact.
- Buyer records settled deal.

Acceptance:

- A successful deal produces a testnet tx hash.
- The deal record includes intent, seller pubkey, final price, tx hash, and artifact.
- Telegram notification includes the final settlement summary.

## Example Successful Negotiation

Buyer human:

```text
Find me a USB-C cable under $5.
```

Buyer policy:

```json
{
  "item": "USB-C cable",
  "quantity": 1,
  "max_price": 5,
  "target_price": 4,
  "currency": "USDC",
  "max_rounds": 3,
  "require_human_confirmation_before_payment": true
}
```

Seller policy:

```json
{
  "item_id": "cable-usbc-001",
  "item_name": "USB-C cable",
  "list_price": 6,
  "min_price": 4.5,
  "currency": "USDC",
  "inventory_available": 10,
  "fulfillment_terms": "redemption code immediately",
  "max_rounds": 3
}
```

Negotiation:

```text
Buyer opens at 4.00
Seller counters at 5.50
Buyer counters at 4.50
Seller counters at 4.75
Buyer accepts at 4.75
Human confirms payment
Buyer pays 4.75 USDC through x402
Seller returns redemption code
```

## Example Blocked Negotiation

Buyer cap:

```json
{ "max_price": 5 }
```

Seller final ask:

```json
{ "accepted_price": 7 }
```

Buyer shim result:

```json
{
  "allow": false,
  "reason": "accepted_price_exceeds_max_price"
}
```

Required behavior:

- Buyer sends `bidmesh.negotiate.walk`.
- No settlement is attempted.
- Audit log records attempted price `7` and cap `5`.

## Open Questions

- Should `target_price` be shown to the user during confirmation or treated as an internal strategy value?
- Should sellers support temporary inventory reservations before payment?
- Should NuffV1 require signatures in the first MVP, or only after the A2A loop is stable?
- Should buyer agents negotiate with sellers serially or in small parallel batches?
- Should human confirmation happen only before payment, or also before accepting a final price?

## MVP Recommendation

For the four-day MVP:

- Use single-issue price negotiation only.
- Require human confirmation before payment.
- Keep buyer `max_price` and seller `min_price` private.
- Use deterministic buyer and seller heuristics.
- Enforce caps and floors with validation shims, not LLM prompts.
- Log every outbound offer, counter, accept, walk, block, and settlement.
- Set `max_rounds = 3`.
- Walk quickly when the price boundaries do not overlap.
