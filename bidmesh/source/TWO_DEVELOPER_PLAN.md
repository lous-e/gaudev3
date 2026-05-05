# BidMesh MVP Two-Developer Plan

## Goal

Ship the 3-4 hour BidMesh MVP as a functional ClawHub skill named `bidmesh-negotiate`.

The demo must show:

- A buyer agent negotiating with a seller over NuffV1-style JSON-RPC messages.
- Deterministic buyer and seller validation shims.
- A human confirmation step before mock settlement.
- A settled mock deal with tx hash and proof artifact.
- Audit logs proving blocked actions cannot exceed human policy.

Canonical implementation spec: `plan.md`.
Protocol vision/reference: `knowledge_base/vision.md`.

## Team Split

### Developer 1: Protocol, Server, and Core Safety

Owns the shared domain model, validation shims, seller server, and core tests.

Primary files:

- `src/types.ts`
- `src/schemas.ts`
- `src/validation.ts`
- `src/heuristics.ts`
- `src/audit.ts`
- `src/seller-server.ts`
- `tests/schemas.test.ts`
- `tests/validation.test.ts`
- `tests/heuristics.test.ts`

Developer 1 is responsible for making the negotiation rules deterministic, typed, and hard to bypass.

### Developer 2: Buyer Loop, Demo, Skill Packaging, and Integration

Owns the buyer negotiation loop, demo script, skill descriptor, and end-to-end test.

Primary files:

- `package.json`
- `tsconfig.json`
- `SKILL.md`
- `src/buyer-agent.ts`
- `src/demo.ts`
- `tests/negotiation.test.ts`

Developer 2 is responsible for making the YC demo feel clean, legible, and shippable.

## Shared Contract

Both developers must agree on these names before coding:

```ts
type RpcMethod =
  | "bidmesh.negotiate.open"
  | "bidmesh.negotiate.counter"
  | "bidmesh.negotiate.accept"
  | "bidmesh.negotiate.walk"
  | "bidmesh.negotiate.status";
```

```ts
type ValidationResult =
  | { allow: true }
  | { allow: false; reason: string };
```

```ts
type DealPhase =
  | "open"
  | "countering"
  | "accepted"
  | "settling"
  | "settled"
  | "walked";
```

Public protocol string:

```ts
protocol: "nuff/v1"
```

Currency for MVP:

```ts
currency: "USDC"
```

Mock network:

```ts
network: "base-sepolia"
```

## Build Schedule

### Hour 0: Setup and Contract Lock

Developer 1:

- Create `src/types.ts`.
- Add all shared exported types from `plan.md`.
- Include `BuyerIntent`, `SellerPolicy`, request/response shapes, audit entries, `Deal`, and `DealPhase`.

Developer 2:

- Create `package.json`.
- Create `tsconfig.json`.
- Install dependencies if needed.
- Stub `src/buyer-agent.ts` and `src/demo.ts` imports against Developer 1's planned exports.

Checkpoint:

- `npm install` succeeds.
- `npm run build` may fail only because implementations are still missing, not because files or dependencies are absent.

### Hour 1: Deterministic Core

Developer 1:

- Implement `src/schemas.ts`.
- Implement `src/validation.ts`.
- Implement `src/heuristics.ts`.
- Add schema, validation, and heuristic tests.

Developer 2:

- Implement the buyer loop skeleton in `src/buyer-agent.ts`.
- Define the function signature:

```ts
export async function runBuyerNegotiation(
  intent: BuyerIntent,
  strategy: BuyerStrategy,
  sellerUrl: string,
  sellerPubkey: string,
  askForHumanConfirmation: (summary: string) => Promise<boolean>
): Promise<{ settled: boolean; deal?: Deal; txHash?: string }>;
```

- Do not fill server-specific behavior until Developer 1's route responses are stable.

Checkpoint:

- `npm test` should pass for Developer 1's unit tests.
- Buyer loop compiles against exported shared types.

### Hour 2: Seller Server and Audit

Developer 1:

- Implement `src/audit.ts`.
- Implement `src/seller-server.ts`.
- Export a server factory rather than starting the server at import time:

```ts
export function createSellerServer(policy: SellerPolicy): express.Express;
```

- Keep deal state in an in-memory `Map<string, Deal>`.
- Add mock settlement route:

```text
POST /settle/:deal_id
```

Developer 2:

- Fill in HTTP calls from `src/buyer-agent.ts` to:
  - `POST /rpc`
  - `POST /settle/:deal_id`
- Run every outbound price through `validateBuyerAction`.
- Write blocked buyer audit entries before walking.
- Add the human confirmation branch.

Checkpoint:

- Seller server can handle `open`, `counter`, `accept`, `walk`, and `status`.
- Buyer can negotiate against a manually started seller server.

### Hour 3: Demo and Integration

Developer 1:

- Help stabilize integration failures.
- Add any missing seller audit fields.
- Verify seller never accepts below `min_price`.
- Verify seller never settles unsupported currency or unavailable quantity.

Developer 2:

- Implement `src/demo.ts`.
- Add `readline` confirmation prompt.
- Print a readable transcript:
  - buyer opening offer
  - seller counters
  - buyer counters
  - acceptance
  - confirmation prompt
  - mock tx hash
  - proof artifact
- Create `SKILL.md`.
- Implement `tests/negotiation.test.ts`.

Checkpoint:

- `npm run demo` shows a full happy path.
- Typing `n` at confirmation walks cleanly.
- Typing `y` settles with a mock tx hash.

### Hour 4: Polish and Dry Run

Developer 1:

- Run all tests.
- Fix type errors and schema gaps.
- Confirm audit logs are append-only JSON lines.
- Confirm the forced over-cap scenario is blocked before HTTP settlement.

Developer 2:

- Polish demo output.
- Confirm `SKILL.md` matches ClawHub expectations.
- Run a publish dry-run if tooling is available.
- Prepare the 2-minute YC demo script.

Checkpoint:

- `npm test` passes.
- `npm run demo` passes.
- `SKILL.md` exists and describes guarantees.
- Audit logs prove the validation shim works.

## File Ownership Rules

To avoid collisions:

- Developer 1 owns shared core files and server internals.
- Developer 2 owns buyer/demo/packaging files.
- Both may edit tests, but should avoid editing the same test file at the same time.
- If a shared type needs to change, Developer 1 makes the type change first, then Developer 2 adapts the buyer loop.
- Neither developer should change the protocol method names after Hour 0 without explicit agreement.

## Integration Contract

The seller `/rpc` endpoint accepts this shape:

```ts
type RpcRequest<TBody> = {
  protocol: "nuff/v1";
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
```

The seller `/rpc` endpoint returns method-specific response bodies directly:

- `OpenResponse`
- `CounterResponse`
- `AcceptResponse`
- `WalkResponse`
- `StatusResponse`

For MVP, HTTP errors should be reserved for malformed requests and unexpected server failures. Negotiation failures should return structured walk/block responses.

## Acceptance Tests

The two-developer build is done when these pass:

```bash
npm test
npm run demo
```

Required test scenarios:

- Schemas reject invalid currency.
- Schemas reject missing or negative prices.
- Buyer blocks `7 USDC` when `max_price = 5`.
- Buyer blocks settlement without human confirmation.
- Seller blocks acceptance below `min_price`.
- Seller blocks quantity above inventory.
- Happy path settles at `<= buyer.max_price` and `>= seller.min_price`.
- No-overlap cases walk cleanly.
- Forced over-cap mutation creates a blocked audit entry and no settlement.

## Demo Script

Run 1:

1. Start `npm run demo`.
2. Let agents negotiate to a valid final price.
3. Type `n` at confirmation.
4. Show the deal walks without settlement.

Run 2:

1. Start `npm run demo`.
2. Let agents negotiate to a valid final price.
3. Type `y` at confirmation.
4. Show mock tx hash and artifact.
5. Show `buyer/workspace/memory/audit.log`.

Pitch line:

```text
The agent can negotiate autonomously, but the validation shim makes overspending impossible.
```

## Cut Line

If time gets tight, cut in this order:

1. `status` route polish.
2. Extra transcript formatting.
3. Publish dry-run.
4. Some integration tests.

Do not cut:

- Buyer validation shim.
- Seller floor validation.
- Human confirmation before settlement.
- Happy-path demo.
- Blocked over-cap audit entry.

## Final Deliverables

- `plan.md`: canonical MVP implementation plan.
- `knowledge_base/vision.md`: longer protocol vision.
- `TWO_DEVELOPER_PLAN.md`: developer split and execution plan.
- Working skill files:
  - `SKILL.md`
  - `package.json`
  - `tsconfig.json`
  - `src/*`
  - `tests/*`
- Passing demo:

```bash
npm run demo
```

- Passing tests:

```bash
npm test
```
