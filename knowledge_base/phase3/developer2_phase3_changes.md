# Developer 2 Phase 3 Changes

Primary plan:

- `knowledge_base/TWO_DEVELOPER_PLAN.md`

Reference plan:

- `knowledge_base/plan.md`

Phase interpreted as:

- Two-developer plan Hour 3, Developer 2 task: implement `src/demo.ts`, create `SKILL.md`, and implement `tests/negotiation.test.ts`.

## Changes Made

### 1. Implemented demo wiring in `src/demo.ts`

The demo now:

- Defines the hardcoded USB-C cable seller policy.
- Defines the buyer intent and buyer strategy from the MVP plan.
- Starts `createSellerServer(sellerPolicy)` on port `3001` by default.
- Prompts the human through `readline`.
- Calls `runBuyerNegotiation(...)`.
- Prints the buyer transcript returned by `runBuyerNegotiation(...)`.
- Prints settled or walked results.
- Prints the settlement artifact when present.
- Closes the HTTP server in a `finally` block.
- Supports `BUYER_MAX_PRICE` as a positive numeric environment override.

Runtime caveat:

- `createSellerServer(...)` is still Developer 1-owned and currently a stub, so `npm run demo` cannot complete until Developer 1 implements `src/seller-server.ts`.

### 2. Created `SKILL.md`

Added the ClawHub skill descriptor with:

- `name: bidmesh-negotiate`
- description
- version
- OpenClaw runtime requirements
- optional `SELLER_URL`
- optional `BUYER_MAX_PRICE`
- usage instructions
- key guarantees
- NuffV1 method list

### 3. Added `tests/negotiation.test.ts`

Added buyer-loop integration-style tests that mock Developer 1-owned modules:

- `src/validation.ts`
- `src/audit.ts`
- `src/heuristics.ts`

The tests use a local Node HTTP mock seller instead of `createSellerServer(...)` because the Developer 1 seller server is still a stub.

Covered scenarios:

- Happy path settles at or below buyer max.
- Buyer walks when cap is too low and seller does not accept counters.
- Seller floor/no-overlap equivalent walks when seller keeps countering above the buyer cap.
- Buyer walks cleanly when seller returns a structured accept denial.
- Forced over-cap opening offer is blocked before HTTP and written to buyer audit.
- Human-denied confirmation does not settle and writes a blocked audit entry.

### 4. Fixed TypeScript build scope

Updated `tsconfig.json` so the app build compiles `src/**/*` only:

```json
"include": ["src/**/*"],
"exclude": ["node_modules", "dist", "tests", "klodi-plugin"]
```

This keeps Vitest test files out of `tsc` app builds while allowing Vitest to transform tests itself.

### 5. Removed generated test JavaScript

Deleted `tests/negotiation.test.js`, which was generated during an intermediate `tsc` attempt and caused Vitest to run both the source test and a stale CommonJS-compiled copy.

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

Ran:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' test
```

Result:

```text
Test Files  1 passed (1)
Tests       6 passed (6)
```

Exit code: `0`.

## What Was Not Done

- `npm run demo` was not run successfully because Developer 1-owned `createSellerServer(...)` still throws.
- No Developer 1-owned files were implemented.
- The tests still use mocks for Developer 1-owned modules because the real implementations are still stubs.

## Review Follow-Up

The first Phase 3 review found Developer 2 gaps:

1. Tests were buyer-loop tests with mocks, not true seller-server integration tests.
2. The required no-overlap/seller-floor scenario was missing.
3. The demo did not print transcript or artifact.
4. `SKILL.md` advertised `BUYER_MAX_PRICE`, but the demo ignored it.
5. The confirmation prompt duplicated reply instructions.

Fixes applied:

- Added a no-overlap test where the seller keeps countering above the buyer cap.
- Added transcript and artifact fields to `BuyerNegotiationResult`.
- Updated `runBuyerNegotiation(...)` to collect transcript lines for opening, counters, walks, settlement, and artifact.
- Updated `src/demo.ts` to print the transcript and artifact.
- Updated `src/demo.ts` to read `BUYER_MAX_PRICE`.
- Simplified the demo prompt suffix to avoid duplicating the reply instruction already present in the confirmation summary.
- Moved the transcript into the human confirmation prompt so the buyer sees the negotiation before deciding whether to pay.
- Removed the extra setup-time opening line from `src/demo.ts` so the opening offer is not duplicated.

Remaining limitation:

- The tests still cannot use the real `createSellerServer(...)` until Developer 1 implements it.

Re-ran:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' run build
& 'C:\nvm4w\nodejs\npm.cmd' test
```

Result:

```text
build: passed
tests: 6 passed
```

## Known Carry-Forward Risks

- Demo runtime depends on Developer 1 implementing `src/seller-server.ts`, `src/validation.ts`, `src/heuristics.ts`, and `src/audit.ts`.
- Tests mock Developer 1 modules, so they verify Developer 2 buyer-loop behavior but not the real seller server.
- `SKILL.md` has not been tested with a real ClawHub publish dry-run.
