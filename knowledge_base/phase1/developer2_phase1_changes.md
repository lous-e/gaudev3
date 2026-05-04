# Developer 2 Phase 1 Changes

Primary plan:

- `knowledge_base/TWO_DEVELOPER_PLAN.md`

Reference plan:

- `knowledge_base/plan.md`

Phase interpreted as:

- Two-developer plan Hour 1, Developer 2 task: implement the buyer loop skeleton in `src/buyer-agent.ts`.

## Changes Made

### 1. Expanded `src/buyer-agent.ts` from an empty throw into a compile-safe skeleton

Added imports for the planned shared types:

- `NuffEnvelope`
- `OpenRequest`

Kept the required public function signature:

```ts
export async function runBuyerNegotiation(
  intent: BuyerIntent,
  strategy: BuyerStrategy,
  sellerUrl: string,
  sellerPubkey: string,
  askForHumanConfirmation: HumanConfirmationPrompt
): Promise<BuyerNegotiationResult>
```

### 2. Added skeleton helper types and functions

Added:

- `BuyerLoopSkeleton`
- `BuyerOpenEnvelope`
- `buildOpenEnvelope(...)`
- `formatConfirmationSummary(...)`
- `createBuyerLoopSkeleton(...)`

These provide structure for the later negotiation loop without performing HTTP calls or invoking Developer 1-owned logic.

### 3. Added opening offer clamping

The skeleton clamps the buyer opening offer to the human cap:

```ts
Math.min(strategy.opening_offer, intent.max_price)
```

This is not a substitute for the future validation shim. It is only a local skeleton guard so the generated opening envelope does not begin above the known cap.

### 4. Added NuffV1 opening envelope construction

The skeleton builds a `NuffEnvelope<OpenRequest>` with:

- `protocol: "nuff/v1"`
- `method: "bidmesh.negotiate.open"`
- `deal_id: "pending"`
- `from_pubkey: "mock-buyer-pubkey"`
- `to_pubkey: sellerPubkey`
- `round: 1`
- `signature: "mock"`
- `body.initial_offer`
- `body.currency`
- `body.item`
- `body.quantity`
- `body.constraints`

### 5. Added confirmation summary formatting

The skeleton can format the eventual human confirmation prompt:

```text
Confirm purchase?

Item: USB-C cable
Seller: mock-seller-pubkey
Final price: 4.00 USDC
Delivery: not specified

Reply y to pay or n to cancel.
```

### 6. Kept HTTP negotiation deferred

`runBuyerNegotiation(...)` now creates the skeleton, but still throws explicitly:

```text
runBuyerNegotiation has the Hour 1 buyer loop skeleton, but HTTP negotiation is deferred until Developer 1 lands validation, heuristics, audit, and seller-server implementations.
```

This is intentional. The two-developer plan says not to fill server-specific behavior until Developer 1's route responses are stable.

## Verification

Ran:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' run build
```

Result:

```text
> bidmesh-negotiate@1.0.0 build
> tsc
```

Exit code: `0`.

## What Was Not Done

- No HTTP calls were added.
- No `/rpc` or `/settle/:deal_id` logic was added.
- No calls to `validateBuyerAction` were added.
- No calls to `writeBuyerAudit` were added.
- No integration tests were added.
- `src/demo.ts` was not changed.

Those items belong to later Developer 2 phases or Developer 1-owned implementation phases.

## Review Follow-Up

The Phase 1 reviewer identified that the first skeleton omitted the top-level RPC `method` required by the two-developer integration contract. This was fixed by adding:

```ts
export type BuyerOpenEnvelope = NuffEnvelope<OpenRequest> & {
  method: Extract<RpcMethod, "bidmesh.negotiate.open">;
};
```

and setting:

```ts
method: "bidmesh.negotiate.open"
```

inside `buildOpenEnvelope(...)`.
