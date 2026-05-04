# Developer 1 Phase 2 Review

## Scope

- Developer 1 review scope:
- `src/validation.ts`
- `src/heuristics.ts`
- `tests/validation.test.ts`
- `tests/heuristics.test.ts`

## Reviewer

- Developer 1 review agent: `Godel` (`019df46b-5c95-7cf3-9de5-0ab338872d19`)

## Findings

1. High: Buyer strategy allowed `target_price > max_price`, which could lead to an out-of-policy accept decision.
2. Medium: Seller validation did not reject non-positive quantities.
3. Medium: Reservation expiry checks could be bypassed with malformed timestamps.
4. Medium: Seller currency validation was hardcoded instead of following `SellerPolicy.currency`.
5. Low: Buyer-side heuristic coverage was too thin around cap clamping and round-limit behavior.

## Resolution

- Clamped buyer target/preferred price to `max_price` in `defaultBuyerStrategy`.
- Made `decideBuyerMove` check the hard cap before any target-price accept path.
- Added a schema invariant requiring `target_price <= max_price`.
- Rejected seller actions with `quantity <= 0`.
- Switched seller currency validation to compare against the configured seller policy.
- Hardened reservation deadline parsing to reject malformed timestamps.
- Added buyer heuristic tests for clamping, cap-safe decisions, and monotonic counters.
- Added validation tests for invalid quantity, buyer-intent cap invariants, policy-driven currency checks, and malformed reservation timestamps.

## Verification

- `npm run build`
- `npm test`
