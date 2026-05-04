# BidMesh MVP — ClawHub Skill Implementation Plan

**Time budget:** 3–4 hours  
**Target:** Functional ClawHub skill publishable to the OpenClaw registry  
**Pitch context:** YC demo — agent-to-agent marketplace with human-guardrailed bidding

---

## What You're Building

A single ClawHub skill (`bidmesh-negotiate`) that turns any OpenClaw agent into a **buyer or seller** in a deterministic price-negotiation loop. Both sides run locally (simulating A2A over an in-process HTTP server), the validation shim enforces spend caps without any LLM calls, and a minimal Express server acts as the marketplace relay. The demo ends with a logged "settled" deal and a mock x402 payment receipt.

**YC hook:** "Your AI agent can buy things autonomously — but it can never spend more than you told it to."

---

## Scope Cuts for 3–4 Hours

| Cut | Reason |
|---|---|
| Nostr / real Nostr signatures | Replace with UUID pubkeys + SHA-256 HMAC |
| Real x402 / Base-Sepolia on-chain tx | Return a mock `{ txHash, amount, network }` object |
| Telegram confirmation UI | Stdout `readline` prompt in the demo script |
| Parallel seller discovery | Single hardcoded seller |
| Persistent deal storage | In-memory Map; append-only `audit.log` file |
| NuffV1 signature verification | Envelope is built and logged, sig field is `"mock"` |

Everything else from `plan.md` is implemented fully.

---

## File Layout

```
gaude_v3/
├── SKILL.md                    ← ClawHub skill descriptor
├── package.json
├── tsconfig.json
├── src/
│   ├── types.ts                ← BuyerIntent, SellerPolicy, NuffEnvelope, etc.
│   ├── schemas.ts              ← Zod validators for every request/response
│   ├── validation.ts           ← Buyer + seller shims (pure functions, no LLM)
│   ├── heuristics.ts           ← decideBuyerMove / decideSellerMove
│   ├── audit.ts                ← Append-only audit log writer
│   ├── seller-server.ts        ← Express: handles all bidmesh.negotiate.* routes
│   ├── buyer-agent.ts          ← Buyer negotiation loop
│   └── demo.ts                 ← Wires buyer + seller, runs the demo
└── tests/
    ├── schemas.test.ts
    ├── validation.test.ts
    ├── heuristics.test.ts
    └── negotiation.test.ts
```

---

## Phase 1 — Project Scaffold (15 min)

### `package.json`

```json
{
  "name": "bidmesh-negotiate",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "demo": "npx ts-node src/demo.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "zod": "^3.22.4",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "vitest": "^1.2.0"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true
  }
}
```

---

## Phase 2 — Types and Schemas (30 min)

### `src/types.ts`

Implement verbatim from `plan.md`:
- `BuyerIntent`
- `SellerPolicy`
- `BuyerStrategy` / `SellerStrategy`
- `NuffEnvelope<TBody>`
- `OpenRequest` / `OpenResponse`
- `CounterRequest` / `CounterResponse`
- `AcceptRequest` / `AcceptResponse`
- `WalkRequest` / `WalkResponse`
- `StatusRequest` / `StatusResponse`
- `BuyerAuditEntry` / `SellerAuditEntry`

Add one union:
```ts
export type DealPhase =
  "open" | "countering" | "accepted" | "settling" | "settled" | "walked";

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
```

### `src/schemas.ts`

Zod schema for each type. Key rules to encode:
- `currency` must be `"USDC"` (literal)
- `price` / `max_price` / `min_price` must be `z.number().positive()`
- `round` must be `z.number().int().min(1)`
- `reason_code` must match the union from `WalkRequest`
- `phase` must match `DealPhase` union

Export `parse*` helpers that throw `ZodError` on invalid input.

**Tests in `tests/schemas.test.ts`:**
```
✓ rejects currency "ETH"
✓ rejects missing price on OpenRequest
✓ rejects negative quantity
✓ accepts valid open/counter/accept/walk/status messages
✓ rejects unknown method name (tested by attempt to parse wrong shape)
```

---

## Phase 3 — Validation Shims (30 min)

### `src/validation.ts`

```ts
export function validateBuyerAction(
  action: "open" | "counter" | "accept" | "settle",
  price: number,
  intent: BuyerIntent,
  humanConfirmed: boolean
): ValidationResult

export function validateSellerAction(
  action: "accept" | "counter",
  price: number,
  quantity: number,
  policy: SellerPolicy
): ValidationResult
```

Rules exactly from `plan.md`:
- Buyer: reject if `price > intent.max_price`
- Buyer: reject settle if `!humanConfirmed && intent.require_human_confirmation_before_payment`
- Seller: reject accept if `price < policy.min_price`
- Seller: reject if `quantity > policy.inventory_available`
- Seller: reject unsupported currencies

Both functions are **pure** — no I/O, no async.

**Tests in `tests/validation.test.ts`:**
```
✓ buyer blocks offer of 7 when max_price = 5
✓ buyer blocks settle without human confirmation
✓ buyer allows offer of 4.75 when max_price = 5
✓ seller blocks accept at 3 when min_price = 4.5
✓ seller blocks quantity 11 when inventory = 10
✓ seller allows accept at 4.75 when min_price = 4.5
```

---

## Phase 4 — Heuristics (20 min)

### `src/heuristics.ts`

Implement verbatim from `plan.md`:

```ts
export function decideBuyerMove(params: {
  sellerPrice: number;
  targetPrice: number;
  maxPrice: number;
  round: number;
  maxRounds: number;
}): "accept" | "counter" | "walk"

export function nextBuyerCounter(
  openingOffer: number, maxPrice: number,
  round: number, maxRounds: number
): number

export function decideSellerMove(params: {
  buyerPrice: number;
  listPrice: number;
  minPrice: number;
  round: number;
  maxRounds: number;
}): "accept" | "counter" | "walk"

export function nextSellerCounter(
  listPrice: number, minPrice: number,
  round: number, maxRounds: number
): number
```

**Tests in `tests/heuristics.test.ts`:**
```
✓ buyer accepts when sellerPrice <= targetPrice
✓ buyer accepts at maxRounds if sellerPrice <= maxPrice
✓ buyer walks at maxRounds if sellerPrice > maxPrice
✓ buyer counters otherwise
✓ seller accepts when buyerPrice >= listPrice
✓ seller walks at maxRounds if buyerPrice < minPrice
✓ nextBuyerCounter never exceeds maxPrice
✓ nextSellerCounter never goes below minPrice
```

---

## Phase 5 — Audit Log (15 min)

### `src/audit.ts`

```ts
export function writeBuyerAudit(entry: BuyerAuditEntry): void
export function writeSellerAudit(entry: SellerAuditEntry): void
```

Appends JSON lines to:
- `buyer/workspace/memory/audit.log`
- `seller/workspace/memory/audit.log`

Creates directories if absent. Synchronous `fs.appendFileSync` — simple and crash-safe enough for demo.

---

## Phase 6 — Seller HTTP Server (30 min)

### `src/seller-server.ts`

Express app on `PORT=3001`. In-memory `deals: Map<string, Deal>`.

#### Routes

| Method | Path | Handler |
|---|---|---|
| `POST` | `/rpc` | Dispatch by `method` field |

Dispatcher reads `envelope.body.method` (or top-level `method`) and routes to:

**`bidmesh.negotiate.open`**
1. Parse + validate `OpenRequest` with Zod.
2. Run `validateSellerAction("counter", openRequest.initial_offer, openRequest.quantity, policy)`.
3. Run `decideSellerMove`.
4. Create `Deal` record, store in map.
5. Return `OpenResponse` with `counter_price` or `accepted: true`.
6. Write seller audit entry.

**`bidmesh.negotiate.counter`**
1. Look up deal by `deal_id`.
2. Validate round limit (`deal.round >= policy.max_rounds → walk`).
3. Run `decideSellerMove` with updated round.
4. Update deal, write audit.
5. Return `CounterResponse`.

**`bidmesh.negotiate.accept`**
1. Run `validateSellerAction("accept", accepted_price, ...)`.
2. If blocked → return walk response + write audit blocked entry.
3. Reserve inventory (`policy.inventory_available -= quantity`).
4. Return `AcceptResponse` with mock x402 payment challenge:
```json
{
  "payment_required": {
    "network": "base-sepolia",
    "asset": "USDC",
    "amount": 4.75,
    "pay_to": "0xMOCK_SELLER_WALLET",
    "expires_at": "<ISO + 10 min>"
  },
  "settlement_url": "http://localhost:3001/settle/<deal_id>"
}
```

**`bidmesh.negotiate.walk`**
1. Mark deal `walked`, release inventory if reserved.
2. Write audit. Return `WalkResponse`.

**`bidmesh.negotiate.status`**
1. Return current `Deal` as `StatusResponse`.

**`POST /settle/:deal_id`**
1. Mark deal `settled`.
2. Return mock proof:
```json
{ "txHash": "0xMOCK...", "artifact": "redemption-code-ABC123" }
```

---

## Phase 7 — Buyer Agent (30 min)

### `src/buyer-agent.ts`

```ts
export async function runBuyerNegotiation(
  intent: BuyerIntent,
  strategy: BuyerStrategy,
  sellerUrl: string,
  sellerPubkey: string,
  askForHumanConfirmation: (summary: string) => Promise<boolean>
): Promise<{ settled: boolean; deal?: Deal; txHash?: string }>
```

Loop:

1. Build `NuffEnvelope<OpenRequest>`, validate with buyer shim.
2. POST to `sellerUrl/rpc` with method `bidmesh.negotiate.open`.
3. Parse `OpenResponse`.
4. Enter negotiation loop (max `intent.max_rounds` iterations):
   - If `accepted`: proceed to human confirmation step.
   - If `counter_price`:
     - Run `decideBuyerMove`.
     - If `accept` → POST `bidmesh.negotiate.accept`.
     - If `counter` → compute `nextBuyerCounter`, validate with shim, POST `bidmesh.negotiate.counter`.
     - If `walk` → POST `bidmesh.negotiate.walk`, return `{ settled: false }`.
5. Human confirmation step:
   - Format summary string.
   - Call `askForHumanConfirmation(summary)`.
   - If denied → POST walk, return `{ settled: false }`.
   - If confirmed → POST to `/settle/:deal_id`.
6. Return `{ settled: true, deal, txHash }`.

Every outbound call runs through `validateBuyerAction` first. Any `{ allow: false }` result → write blocked audit entry → POST walk.

---

## Phase 8 — Demo Script (20 min)

### `src/demo.ts`

1. Define the hardcoded seller policy (USB-C cable from `plan.md`).
2. Start the seller Express server on port 3001.
3. Define the buyer intent (from `plan.md`).
4. Define `askForHumanConfirmation` using `readline` (stdout prompt).
5. Call `runBuyerNegotiation`.
6. Print the full negotiation transcript and final deal record.
7. Exit.

Expected output:
```
[Buyer] Opening at 4.00 USDC
[Seller] Counter: 5.50 USDC
[Buyer] Counter: 4.33 USDC
[Seller] Counter: 4.83 USDC
[Buyer] Counter: 4.67 USDC
[Seller] Accept: 4.75 USDC

Confirm purchase?
  Item: USB-C cable
  Seller: mock-seller-pubkey
  Final price: 4.75 USDC
  Delivery: redemption code immediately

Reply y to pay or n to cancel: y

[Settled] txHash: 0xMOCKABC123
[Artifact] redemption-code-ABC123
```

---

## Phase 9 — Integration Test (20 min)

### `tests/negotiation.test.ts`

Four scenarios, fully in-process (start seller server on a random port, run buyer):

| Scenario | Buyer max | Seller min | Expected |
|---|---|---|---|
| Happy path | 5.00 | 4.50 | settled at ≤ 5.00, ≥ 4.50 |
| Buyer cap too low | 3.00 | 4.50 | walked (buyer walks round limit) |
| Seller floor too high | 5.00 | 6.00 | walked (no overlap) |
| Shim blocks forced 7 USDC | 5.00 | 4.50 | blocked entry in audit.log, no settlement |

The shim-block test injects a mutated buyer that tries to offer 7 USDC, confirming the shim fires before the HTTP call.

---

## Phase 10 — SKILL.md (15 min)

```markdown
---
name: bidmesh-negotiate
description: >
  Agent-to-agent price negotiation with human-guardrailed spend caps.
  Buyer and seller agents settle a deal autonomously within human-defined
  policy limits. No LLM call can exceed the buyer's max_price or the
  seller's min_price.
version: 1.0.0
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npx
    envVars:
      - name: SELLER_URL
        required: false
        description: URL of the seller negotiation server (default localhost:3001)
      - name: BUYER_MAX_PRICE
        required: false
        description: Override max price at runtime
---

# BidMesh Negotiate

A deterministic price-negotiation skill for OpenClaw agents.

## What This Skill Does

- Extracts a BuyerIntent from natural language and confirms it with the human
- Runs a capped negotiation loop against a NuffV1-compatible seller endpoint
- Blocks any offer, counter, or acceptance that exceeds the human-set spend cap
- Requires human confirmation before any payment settlement
- Produces an append-only audit log of every action

## Usage

Install and run the demo:

\```
clawhub install bidmesh-negotiate
npm install && npm run demo
\```

## Key Guarantees

1. The agent cannot spend above `max_price` — enforced by a pure validation
   shim that runs before every outbound call, not by an LLM instruction.
2. No payment is initiated without explicit human confirmation (unless
   `require_human_confirmation_before_payment: false`).
3. Every blocked action is written to `buyer/workspace/memory/audit.log`.

## Protocol

Uses NuffV1: JSON-RPC over HTTPS with methods:
- `bidmesh.negotiate.open`
- `bidmesh.negotiate.counter`
- `bidmesh.negotiate.accept`
- `bidmesh.negotiate.walk`
- `bidmesh.negotiate.status`

See `src/types.ts` for full TypeScript definitions.
```

---

## Build Order (Strict Sequence)

```
Hour 1:  Phase 1 (scaffold) → Phase 2 (types + schemas) → Phase 3 (validation shims)
Hour 2:  Phase 4 (heuristics) → Phase 5 (audit) → Phase 6 (seller server)
Hour 3:  Phase 7 (buyer agent) → Phase 8 (demo script)
Hour 4:  Phase 9 (integration tests) → Phase 10 (SKILL.md) → clawhub publish dry-run
```

If time runs short, cut Phase 9 last — the demo script is the YC pitch artifact, not the tests.

---

## Test Commands

```bash
npm test                          # vitest: unit + integration
npm run demo                      # live negotiation demo
npx ts-node src/demo.ts           # same, without build step
```

Expected test output:
```
✓ schemas: 9 tests
✓ validation: 6 tests
✓ heuristics: 8 tests
✓ negotiation: 4 tests (integration)
```

---

## ClawHub Publish (After Demo Works)

```bash
clawhub publish . \
  --slug bidmesh-negotiate \
  --name "BidMesh Negotiate" \
  --version 1.0.0 \
  --tags latest marketplace negotiation a2a payments
```

---

## YC Demo Script (2-Minute Pitch)

1. Show `plan.md` — "Here's the protocol. Agents negotiate, humans set the rules."
2. Run `npm run demo` live — show the back-and-forth log.
3. At the confirmation prompt, type `n` first — show it walks cleanly.
4. Run again, type `y` — show settlement and mock tx hash.
5. `cat buyer/workspace/memory/audit.log` — show the audit trail.
6. "This is one skill installable with `clawhub install bidmesh-negotiate`. Any OpenClaw agent becomes a buyer or seller in under 5 minutes."

---

## Sources

- [ClawHub — OpenClaw Skill Directory](https://github.com/openclaw/clawhub)
- [Skills — OpenClaw Docs](https://docs.openclaw.ai/tools/skills)
- [SKILL.md format spec](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md)
- [x402 Protocol — Coinbase Developer Docs](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 and Agentic Commerce — AWS Blog](https://aws.amazon.com/blogs/industries/x402-and-agentic-commerce-redefining-autonomous-payments-in-financial-services/)
- [OpenClaw Hooks — Agent Guardrails Guide](https://openclawsanctuary.com/hooks)
- [ClawHub PyPI](https://pypi.org/project/clawhub/)
