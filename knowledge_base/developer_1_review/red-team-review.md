# Developer 1 Red-Team Review

## Scope

- Developer 1 protocol/runtime red-team scope:
- `src/types.ts`
- `src/schemas.ts`
- `src/protocol-security.ts`
- `src/audit.ts`
- `src/seller-server.ts`
- `tests/seller-server.test.ts`
- `tests/stress.test.ts`

## Findings

1. Critical: The protocol originally accepted spoofable mock signatures and had no replay protection.
2. High: Settlement accepted expired payment challenges because `payment_required.expires_at` was never enforced.
3. High: Inventory could be oversold because inventory checks used only static policy state.
4. High: Runtime `open` handling allocated deal state and wrote audit entries before key runtime rejections, creating memory and log amplification risk.
5. Medium: Buyer constraints and deadlines were not persisted or enforced across the full deal lifecycle.
6. Medium: Seller audit entries were too weak to reconstruct spoofing, replay, and race incidents.

## Resolution

- Added signed-envelope verification with per-buyer shared secrets in `src/protocol-security.ts`.
- Added request fingerprint replay detection with bounded in-memory retention.
- Enforced timestamp skew and envelope `expires_at` checks before protocol handlers execute.
- Enforced payment challenge expiry and buyer deadline checks during settlement.
- Added mutable inventory reservation on buyer quote acceptance and prevented oversell on subsequent deals.
- Reordered `open` processing so invalid traffic is rejected before durable deal creation.
- Persisted buyer constraints and deadlines into deal state and rejected unsupported constraints at open time.
- Expanded audit entries with request fingerprint, method, round, phase transition, envelope metadata, quantity, and terms.

## Stress Verification

- Added burst open/replay coverage in `tests/stress.test.ts`.
- Added invalid-open flood coverage to confirm rejected requests do not create usable persistent deal state.
- Added adversarial server tests for spoofed callers, replay, payment expiry, deadline enforcement, oversell prevention, and constraint rejection.

## Verification

- `npm run build`
- `npm test`

## Follow-Up Alignment

- After the hardening pass, the remaining plan mismatches were closed by restoring the documented `signature: "mock"` payload contract, keeping runtime auth in headers, making `createSellerServer(policy)` valid again with optional runtime options, narrowing the shared currency model to `USDC`, and adding a full seller-server no-overlap walk test.
