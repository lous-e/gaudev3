# Developer 2 Phase 2 Changes

Primary plan:

- `knowledge_base/TWO_DEVELOPER_PLAN.md`

Reference plan:

- `knowledge_base/plan.md`

Phase interpreted as:

- Two-developer plan Hour 2, Developer 2 task: fill in buyer-side HTTP calls, run every outbound price through `validateBuyerAction`, write blocked buyer audit entries before walking, and add the human confirmation branch.

## Changes Made

### 1. Added buyer-side RPC envelope builders

Updated `src/buyer-agent.ts` with typed envelope builders for:

- `bidmesh.negotiate.open`
- `bidmesh.negotiate.counter`
- `bidmesh.negotiate.accept`
- `bidmesh.negotiate.walk`

The local `RpcEnvelope<TBody, TMethod>` type keeps the required top-level `method` field from the two-developer integration contract.

### 2. Added HTTP POST helpers

Added:

- `postJson<TResponse>(...)`
- `postRpc<TResponse>(...)`

These use `fetch` to:

- `POST ${sellerUrl}/rpc`
- `POST acceptResponse.settlement_url`

HTTP failures throw with the failing status code.

### 3. Added outbound buyer validation gate

Added `validateOutboundOrWalk(...)`, which calls:

```ts
validateBuyerAction(action, price, intent, humanConfirmed)
```

before outbound:

- open
- counter
- accept
- settle

If validation denies the action, the buyer writes a blocked audit entry and sends `bidmesh.negotiate.walk` when a real deal id is available.

The opening offer is no longer clamped before validation. The attempted `strategy.opening_offer` is preserved so a forced over-cap opening offer can be blocked and audited instead of silently normalized.

### 4. Added blocked audit writes

Added `writeBlockedAudit(...)`, which writes a `BuyerAuditEntry` through Developer 1's planned `writeBuyerAudit(...)` export.

Blocked entries include:

- timestamp
- session id
- deal id
- counterparty pubkey
- attempted price
- cap
- reason
- `allowed: false`

### 5. Added negotiation control flow

`runBuyerNegotiation(...)` now:

1. Builds the opening skeleton.
2. Validates the opening offer.
3. Posts `bidmesh.negotiate.open`.
4. Handles seller accept/counter responses.
5. Uses `decideBuyerMove(...)`.
6. Sends counters with `nextBuyerCounter(...)`.
7. Sends walks on price failure or round limit.
8. Calls `acceptAndMaybeSettle(...)` for accepted prices.

### 6. Added human confirmation before settlement

Added `acceptAndMaybeSettle(...)`, which:

1. Validates the accept action.
2. Posts `bidmesh.negotiate.accept`.
3. Formats a human confirmation summary.
4. Calls `askForHumanConfirmation(summary)`.
5. Walks if the human declines.
6. Validates settlement if the human confirms.
7. Posts to the returned settlement URL.
8. Returns a settled result with a mock tx hash from the settlement proof.

### 7. Added local result deal construction

Added `buildDeal(...)` so the buyer can return a local `Deal` object for:

- walked outcomes
- settled outcomes

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

## Review Follow-Up

The first Phase 2 review found three issues:

1. Over-cap opening offers were silently clamped before validation.
2. Seller structured walk responses from `accept` were not handled.
3. Human-denied settlement walked without exercising the buyer validation shim.

Fixes applied:

- Replaced the previous opening-offer clamp with `getOpeningOffer(strategy)`, which returns the attempted `strategy.opening_offer` unchanged.
- Added `isAcceptResponse(...)` so `acceptAndMaybeSettle(...)` detects seller walk/denial responses and returns a walked deal without prompting or dereferencing missing payment fields.
- Updated the human-denied confirmation branch to call `validateOutboundOrWalk({ action: "settle", humanConfirmed: false, ... })` before walking. If the shim denies settlement, the blocked audit path runs.

Re-ran:

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

- No changes were made to Developer 1-owned implementations.
- `validateBuyerAction(...)`, `writeBuyerAudit(...)`, `decideBuyerMove(...)`, `nextBuyerCounter(...)`, and the seller server are still only as functional as Developer 1's files allow.
- No demo script changes were made.
- No integration tests were added.
- No transcript printing was added.

Those items belong to later phases or Developer 1-owned work.

## Known Carry-Forward Risks

- Runtime negotiation will fail until Developer 1 replaces current stubs in `src/validation.ts`, `src/heuristics.ts`, `src/audit.ts`, and `src/seller-server.ts`.
- The opening envelope still uses `deal_id: "pending"` because current `NuffEnvelope<TBody>` requires a `deal_id`.
- Response parsing is typed by TypeScript casts after HTTP JSON parsing; runtime Zod validation depends on Developer 1's schema implementation and is not yet wired into this buyer path.
