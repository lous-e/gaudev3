# Developer 1 Phase 3 Review

## Scope

- Developer 1 review scope:
- `src/audit.ts`
- `src/seller-server.ts`
- `tests/seller-server.test.ts`

## Reviewer

- Developer 1 review agent: `Pasteur` (`019df46c-9b6f-72c3-bd29-c5f4989f8892`)

## Findings

1. High: The server trusted client-supplied `round`, allowing buyers to skip ahead and force late-round seller behavior.
2. High: `accept` was not bound to the seller’s quoted price/terms or a valid pre-settlement deal phase.
3. High: Follow-up negotiation and settlement requests were not bound to the original buyer identity.
4. Medium: Deal state persisted the caller-provided seller pubkey instead of the configured seller identity.
5. Low: Runtime tests did not cover forged rounds, spoofed callers, stale accept flows, or settlement misuse.
6. Critical: The initial protocol/runtime still lacked real request authentication and replay protection.
7. High: Payment challenge expiry and buyer deadlines were not enforced during settlement.
8. High: Inventory was validated statically and could be oversold across concurrent deals.
9. High: Invalid-but-schema-valid `open` traffic could allocate deal state and amplify audit writes before runtime rejection.
10. Medium: Buyer constraints and stronger forensic audit fields were not persisted through the deal lifecycle.

## Resolution

- Made the server authoritative for negotiation rounds and required monotonic follow-up rounds.
- Bound follow-up `/rpc` requests to the original `buyer_pubkey` and configured seller pubkey.
- Bound settlement to the original buyer and enforced `human_confirmation === true`.
- Required buyer `accept` requests to match the seller’s stored quote and terms.
- Persisted the configured seller pubkey into deal state.
- Split blocked-attempt audit logging from terminal deal closure so spoofed requests are auditable without destroying valid deals.
- Expanded server tests to cover forged rounds, spoofed callers, mismatched accept prices, wrong-buyer settlement, and settlement without confirmation.
- Added signed request verification using per-buyer shared secrets plus request fingerprint replay detection.
- Enforced envelope freshness windows and `expires_at` checks before protocol handlers run.
- Enforced `payment_required.expires_at` and buyer deadline checks during settlement.
- Added inventory reservation at buyer quote acceptance and prevented oversell by validating against mutable available inventory.
- Reordered `open` handling so authentication and runtime checks happen before durable deal allocation.
- Persisted buyer constraints and deadlines in deal state and rejected unsupported constraints up front.
- Expanded seller audit entries with method, request round, phases, envelope metadata, quantity, terms, and request fingerprint fields.
- Restored the documented shared envelope shape with `signature: "mock"` while keeping runtime authentication in an out-of-band header.
- Restored the planned `createSellerServer(policy)` API by making runtime options optional.
- Changed `/rpc` negotiation-state failures to return structured method responses instead of relying on HTTP `400`.
- Narrowed the shared MVP currency contract to `USDC`.
- Added a seller-server-level no-overlap runtime walk test.

## Verification

- `npm run build`
- `npm test`
