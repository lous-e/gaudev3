# BidMesh — Open Security Issues (Alpha)

**Last updated:** 2026-05-04T21:16:06Z  |  **Open:** 86  |  **Resolved:** 0

> This file is auto-generated. Mark an issue resolved by setting `"resolved": true`
> and `"resolved_in": "<commit_sha>"` in `alpha.json`, then re-run the hook.

---

## `knowledge_base/redteaming/merge_findings.py`  (15 open)

| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |
|----|----------|--------|----------|---------|------------|----------------|
| `2a761745a048` | PATH_TRAVERSAL | `main` | **Critical** | alpha_md_path derives from attacker-controlled CLI arg alpha_path; writing alpha.md to arbitrary filesystem locations | 36c1d24 | 36c1d24 |
| `d261add94fee` | STATE_VIOLATION | `main` | **High** | alpha.json is truncated by open(...,'w') before json.dump completes; a crash or KeyboardInterrupt between those two lines leaves a zero-byte or partial file | 36c1d24 | 36c1d24 |
| `590af4dee134` | RACE_CONDITION | `main` | **High** | Non-atomic read-modify-write of alpha.json; concurrent invocations cause lost-update; last writer silently wins | 36c1d24 | 36c1d24 |
| `f1240402654a` | INJECTION | `render_alpha_md` | **High** | summary, exploit, fix, anchor, and category from untrusted JSONL are interpolated raw into Markdown table cells and section headers without escaping pipe chars or newlines | 36c1d24 | 36c1d24 |
| `4718d6013a8b` | PATH_TRAVERSAL | `normalize_path` | **High** | lstrip('./') strips only *leading* dot and slash chars; embedded traversal like 'legit/../../etc/passwd' survives and is stored as a file_key in alpha.json | 36c1d24 | 36c1d24 |
| `bcec96e87796` | INFO_DISCLOSURE | `render_alpha_md` | **High** | Working exploit payloads from every finding are written verbatim into the publicly committed alpha.md file | 36c1d24 | 36c1d24 |
| `f0912341ffe6` | LOG_INJECTION | `main` | **Medium** | findings_path (attacker-controlled CLI arg) is embedded unsanitized into a stderr log line, enabling ANSI escape injection or fake log-line injection | 36c1d24 | 36c1d24 |
| `a2a0f61e89df` | SILENT_FAILURE | `parse_findings` | **Medium** | json.JSONDecodeError on any JSONL line is silently swallowed with continue; malformed or deliberately corrupt input is dropped without any warning | 36c1d24 | 36c1d24 |
| `538ab3088358` | UNHANDLED_EXCEPTION | `main` | **Medium** | json.load(alpha_path) and both open() calls are uncaught; FileNotFoundError, PermissionError, or JSONDecodeError crash the process with a raw traceback that leaks internal paths | 36c1d24 | 36c1d24 |
| `dba87a4e5e2f` | UNHANDLED_EXCEPTION | `render_alpha_md` | **Medium** | v['first_seen']['commit'] and v['last_confirmed']['commit'] are accessed without guards; if alpha.json was hand-edited or corrupted, KeyError or TypeError crashes render | 36c1d24 | 36c1d24 |
| `c7cc09cbbc50` | BUSINESS_LOGIC | `merge` | **Medium** | Any finding with an unrecognised category is silently reclassified as INPUT_VALIDATION instead of being rejected, polluting that category with misclassified issues | 36c1d24 | 36c1d24 |
| `860c8bb11e6e` | INPUT_VALIDATION | `merge` | **Medium** | severity field is stored from untrusted JSONL without validation against SEVERITY_ORDER; arbitrary strings are persisted and rendered in bold in Markdown | 36c1d24 | 36c1d24 |
| `c1be081ffe6c` | DOS | `parse_findings` | **Medium** | parse_findings reads the entire JSONL file into memory with no size limit; a multi-GB file causes OOM | 36c1d24 | 36c1d24 |
| `2681025d5fda` | BUSINESS_LOGIC | `vuln_id` | **Medium** | ID collision: sha256(file|category|anchor)[:12] can be pre-computed; an attacker controlling the JSONL can craft a finding that matches an existing vid and silently updates its last_confirmed timestamp without adding a new record | 36c1d24 | 36c1d24 |
| `3aa75b813f4c` | INPUT_VALIDATION | `main` | **Low** | commit_sha is accepted as a raw CLI string with no length or character validation; stored in JSON and sliced to 7 chars in Markdown without sanitisation | 36c1d24 | 36c1d24 |

### `2a761745a048` — alpha_md_path derives from attacker-controlled CLI arg alpha_path; writing alpha.md to arbitrary filesystem locations

**Exploit:** python3 merge_findings.py findings.jsonl abc123 /var/www/html/../../etc/cron.d/alpha.json â€” alpha.md lands in /etc/cron.d/

**Fix:** Resolve and canonicalize alpha_path with os.path.realpath and assert it stays within an expected base directory before any file I/O

### `d261add94fee` — alpha.json is truncated by open(...,'w') before json.dump completes; a crash or KeyboardInterrupt between those two lines leaves a zero-byte or partial file

**Exploit:** Send SIGINT after the write fd is opened but before json.dump returns â€” alpha.json is now corrupt and all prior data is lost

**Fix:** Write to a temp file alongside alpha_path then os.replace() it atomically; catches all partial-write and signal scenarios

### `590af4dee134` — Non-atomic read-modify-write of alpha.json; concurrent invocations cause lost-update; last writer silently wins

**Exploit:** Run two merge_findings.py processes in parallel on different JSONL files; one process's findings are silently dropped from the final alpha.json

**Fix:** Use an advisory lock (e.g. fcntl.flock or a .lock file) around the read-modify-write cycle, or use an atomic compare-and-swap via rename

### `f1240402654a` — summary, exploit, fix, anchor, and category from untrusted JSONL are interpolated raw into Markdown table cells and section headers without escaping pipe chars or newlines

**Exploit:** Craft a finding with summary='foo | Critical | injected_anchor | **Critical** | surprise row' â€” renders an extra table row under arbitrary columns, spoofing severity and counts

**Fix:** Escape | as \| and strip or replace newlines in all user-supplied string fields before inserting into Markdown table cells

### `4718d6013a8b` — lstrip('./') strips only *leading* dot and slash chars; embedded traversal like 'legit/../../etc/passwd' survives and is stored as a file_key in alpha.json

**Exploit:** Submit finding with file='legit/../../etc/passwd' â€” normalize_path returns 'legit/../../etc/passwd', stored verbatim as a key and rendered in alpha.md

**Fix:** Use posixpath.normpath after the replace and reject any key that still contains '..' segments

### `bcec96e87796` — Working exploit payloads from every finding are written verbatim into the publicly committed alpha.md file

**Exploit:** Any user with read access to the repo (including CI logs) sees full exploit strings for every open vulnerability

**Fix:** Omit the exploit field from alpha.md or store it only in alpha.json which can be access-controlled; summarise with a redacted placeholder in the markdown

### `f0912341ffe6` — findings_path (attacker-controlled CLI arg) is embedded unsanitized into a stderr log line, enabling ANSI escape injection or fake log-line injection

**Exploit:** Pass findings_path='run.jsonl\n[merge] alpha.json updated (0 open)' â€” injects a false success log line into stderr

**Fix:** Sanitize findings_path before logging by replacing control characters, or log repr(findings_path) instead

### `a2a0f61e89df` — json.JSONDecodeError on any JSONL line is silently swallowed with continue; malformed or deliberately corrupt input is dropped without any warning

**Exploit:** Inject one malformed JSON line in the middle of findings.jsonl â€” all subsequent valid lines still parse, but the malformed line (which could be a deliberate deletion of a critical finding) disappears silently

**Fix:** At minimum emit a stderr warning on each decode failure; optionally abort if the error rate exceeds a threshold

### `538ab3088358` — json.load(alpha_path) and both open() calls are uncaught; FileNotFoundError, PermissionError, or JSONDecodeError crash the process with a raw traceback that leaks internal paths

**Exploit:** Pass a non-existent alpha.json path â€” unhandled FileNotFoundError exposes full filesystem path in traceback

**Fix:** Wrap all file I/O in explicit try/except blocks with actionable error messages; exit with a non-zero code

### `dba87a4e5e2f` — v['first_seen']['commit'] and v['last_confirmed']['commit'] are accessed without guards; if alpha.json was hand-edited or corrupted, KeyError or TypeError crashes render

**Exploit:** Manually set first_seen to null in alpha.json, then run the script â€” render_alpha_md raises TypeError: 'NoneType' object is not subscriptable

**Fix:** Use safe dict.get() access with fallback empty strings for all nested fields from stored JSON

### `c7cc09cbbc50` — Any finding with an unrecognised category is silently reclassified as INPUT_VALIDATION instead of being rejected, polluting that category with misclassified issues

**Exploit:** Submit finding with category='MAGIC_ZERO_DAY' â€” stored as INPUT_VALIDATION, obscuring actual input-validation issues and distorting severity triage

**Fix:** Reject findings with invalid categories outright (log a warning and skip) rather than silently remapping them

### `860c8bb11e6e` — severity field is stored from untrusted JSONL without validation against SEVERITY_ORDER; arbitrary strings are persisted and rendered in bold in Markdown

**Exploit:** Submit finding with severity='**CRITICAL** </table><script>alert(1)</script>' â€” stored verbatim, rendered as bold HTML in any Markdown renderer that passes through HTML

**Fix:** Validate severity against SEVERITY_ORDER whitelist and default to 'Low' on mismatch, matching the same pattern used for category

### `c1be081ffe6c` — parse_findings reads the entire JSONL file into memory with no size limit; a multi-GB file causes OOM

**Exploit:** Pass a 4 GB findings.jsonl â€” process OOMs and may kill the CI runner or adjacent processes

**Fix:** Add a line-count or byte-size limit (e.g. reject files over 10 MB) before iterating, or stream and impose a per-run finding cap

### `2681025d5fda` — ID collision: sha256(file|category|anchor)[:12] can be pre-computed; an attacker controlling the JSONL can craft a finding that matches an existing vid and silently updates its last_confirmed timestamp without adding a new record

**Exploit:** Compute vid for a known high-severity issue; emit a finding with identical file/category/anchor â€” the existing entry is confirmed-fresh, masking any staleness signal used to auto-resolve it

**Fix:** Include a nonce or run_id in the hash so repeated confirmation requires possessing the original run context; or use a monotonically increasing ID and treat deduplication as a separate query

### `3aa75b813f4c` — commit_sha is accepted as a raw CLI string with no length or character validation; stored in JSON and sliced to 7 chars in Markdown without sanitisation

**Exploit:** Pass commit_sha='../../../../evil' â€” stored verbatim in first_seen/last_confirmed; the [:7] slice produces '../../..' which renders as a relative link in some Markdown renderers

**Fix:** Validate commit_sha matches /^[0-9a-f]{7,40}$/ before using it; reject and exit on mismatch

## `src/audit.ts`  (3 open)

| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |
|----|----------|--------|----------|---------|------------|----------------|
| `565188a0f791` | UNHANDLED_EXCEPTION | `writeBuyerAudit` | **High** | Function always throws, any caller will crash at runtime | abbf92d | abbf92d |
| `c0b0bef25a60` | UNHANDLED_EXCEPTION | `writeSellerAudit` | **High** | Function always throws, any caller will crash at runtime | abbf92d | abbf92d |
| `7d64d20b7e82` | SILENT_FAILURE | `module` | **Medium** | Audit trail is entirely non-functional â€” security events are never recorded | abbf92d | abbf92d |

### `565188a0f791` — Function always throws, any caller will crash at runtime

**Exploit:** Call writeBuyerAudit() with any valid BuyerAuditEntry â€” unconditional throw propagates to caller

**Fix:** Implement the function body or use a no-op stub instead of throwing

### `c0b0bef25a60` — Function always throws, any caller will crash at runtime

**Exploit:** Call writeSellerAudit() with any valid SellerAuditEntry â€” unconditional throw propagates to caller

**Fix:** Implement the function body or use a no-op stub instead of throwing

### `7d64d20b7e82` — Audit trail is entirely non-functional â€” security events are never recorded

**Exploit:** Trigger any auditable action (bid, negotiation, settlement); no audit log is written, violations go undetected

**Fix:** Implement or wire a real audit sink before deploying; failing open on audit is a compliance/forensics risk

## `src/buyer-agent.ts`  (18 open)

| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |
|----|----------|--------|----------|---------|------------|----------------|
| `0048a1cfde1c` | SSRF | `acceptAndMaybeSettle` | **Critical** | Seller-controlled settlement_url used directly in postJson without scheme or host validation, enabling full SSRF | abbf92d | abbf92d |
| `ae775c15442d` | AUTHENTICATION | `createEnvelope` | **Critical** | All outgoing envelopes use hardcoded BUYER_PUBKEY='mock-buyer-pubkey' and signature='mock'; no real identity or integrity | abbf92d | abbf92d |
| `5c967e4e4c48` | AUTHENTICATION | `isAcceptResponse` | **High** | Seller response signatures are never verified; a MITM or rogue seller can forge AcceptResponse with arbitrary settlement_url and payment amount | abbf92d | abbf92d |
| `291db0d610b3` | BUSINESS_LOGIC | `acceptAndMaybeSettle` | **High** | Human confirmation summary shows acceptedPrice but actual payment uses acceptResponse.payment_required.amount, which can differ | abbf92d | abbf92d |
| `82da64f0dede` | AUTHORIZATION | `runBuyerNegotiation` | **High** | openResponse.deal_id is accepted from the seller without validation and used for all subsequent protocol messages, enabling deal-id hijacking | abbf92d | abbf92d |
| `5b0901aea993` | REPLAY_ATTACK | `postRpc` | **High** | No nonce, session token, or response-timestamp validation; a captured seller AcceptResponse can be replayed to trigger duplicate settlement | abbf92d | abbf92d |
| `62803065723d` | SSRF | `normalizeSellerUrl` | **High** | sellerUrl is only stripped of trailing slashes; file://, gopher://, and http://internal-host schemes are accepted | abbf92d | abbf92d |
| `b3b525c31d56` | PARTIAL_FAILURE | `acceptAndMaybeSettle` | **High** | If postJson to settlement_url throws after human confirms, the deal is stranded: seller sees accept, buyer has no txHash, no recovery path | abbf92d | abbf92d |
| `550821deff17` | NUMERIC_EDGE_CASE | `acceptAndMaybeSettle` | **High** | acceptResponse.payment_required.amount is used in toFixed(2) and validateOutboundOrWalk without NaN/Infinity/negative guards | abbf92d | abbf92d |
| `3bd09fbce778` | STATE_VIOLATION | `acceptAndMaybeSettle` | **Medium** | Walk is sent after AcceptResponse is already received; seller state is 'accepted' but buyer sends walk, creating irreconcilable protocol state | abbf92d | abbf92d |
| `3d734c9bea5b` | LOG_INJECTION | `acceptAndMaybeSettle` | **Medium** | proof.txHash and proof.artifact from seller are written to transcript verbatim without newline or control-character sanitization | abbf92d | abbf92d |
| `a2f853b53790` | LOG_INJECTION | `runBuyerNegotiation` | **Medium** | counterResponse.terms from seller is appended to transcript and used in human confirmation summary without sanitization | abbf92d | abbf92d |
| `fa0c81cb677e` | UNHANDLED_EXCEPTION | `postJson` | **Medium** | response.json() is called without try/catch; malformed or truncated JSON body throws an uncaught TypeError that propagates out of runBuyerNegotiation | abbf92d | abbf92d |
| `c9997dc5b91c` | DOS | `postJson` | **Medium** | fetch has no timeout and no response-body size limit; a slow or huge seller response blocks the buyer indefinitely | abbf92d | abbf92d |
| `11a30c676404` | INPUT_VALIDATION | `runBuyerNegotiation` | **Medium** | openResponse.deal_id is used as-is with no length, charset, or format validation; path-traversal or injection payloads reach audit and RPC layers | abbf92d | abbf92d |
| `674be3d64904` | BUSINESS_LOGIC | `validateOutboundOrWalk` | **Medium** | When human declines, validateOutboundOrWalk is called for 'settle' with humanConfirmed=false; if the validator internally blocks, it fires a 'validation_denied' walk before the outer code fires a 'human_confirmation_required' walk, sending two conflicting walks | abbf92d | abbf92d |
| `bf3f1c3a3c9b` | SILENT_FAILURE | `sendWalk` | **Low** | Return value of sendWalk is discarded at every call site; a failed or rejected walk is never detected or retried | abbf92d | abbf92d |
| `31bcb9a22a59` | INFO_DISCLOSURE | `postJson` | **Low** | Error message includes the full URL on HTTP failure, which may expose internal settlement_url values to logs or error boundaries | abbf92d | abbf92d |

### `0048a1cfde1c` — Seller-controlled settlement_url used directly in postJson without scheme or host validation, enabling full SSRF

**Exploit:** Seller returns AcceptResponse with settlement_url set to http://169.254.169.254/latest/meta-data/ or file:///etc/passwd; buyer POSTs payment data there

**Fix:** Validate settlement_url scheme (https-only) and host against an allowlist or the original sellerUrl's host before calling postJson

### `ae775c15442d` — All outgoing envelopes use hardcoded BUYER_PUBKEY='mock-buyer-pubkey' and signature='mock'; no real identity or integrity

**Exploit:** Any party can forge buyer envelopes; seller cannot authenticate the buyer; replay any captured envelope unchanged

**Fix:** Replace with real keypair loaded from secure storage and sign envelope payload with the private key

### `5c967e4e4c48` — Seller response signatures are never verified; a MITM or rogue seller can forge AcceptResponse with arbitrary settlement_url and payment amount

**Exploit:** Intercept OpenResponse/CounterResponse, swap with crafted AcceptResponse; buyer accepts and pays attacker's settlement address

**Fix:** Verify each incoming envelope's signature field against sellerPubkey before processing the body

### `291db0d610b3` — Human confirmation summary shows acceptedPrice but actual payment uses acceptResponse.payment_required.amount, which can differ

**Exploit:** Seller agrees at price 100 but payment_required.amount is 10000; human sees 100 in the confirmation dialog, buyer pays 10000

**Fix:** Display payment_required.amount in the human confirmation summary and validate it equals acceptedPrice within an acceptable tolerance

### `82da64f0dede` — openResponse.deal_id is accepted from the seller without validation and used for all subsequent protocol messages, enabling deal-id hijacking

**Exploit:** Seller returns deal_id of an existing settled deal; buyer re-opens and re-settles that deal, or seller returns deal_id belonging to another buyer

**Fix:** Generate deal_id on the buyer side before opening and reject any response where deal_id does not match

### `5b0901aea993` — No nonce, session token, or response-timestamp validation; a captured seller AcceptResponse can be replayed to trigger duplicate settlement

**Exploit:** Record a valid AcceptResponse; replay it to a fresh runBuyerNegotiation call after the first deal completes; buyer pays twice

**Fix:** Include a buyer-generated nonce in each outgoing envelope and validate that each response references the correct nonce and a fresh timestamp

### `62803065723d` — sellerUrl is only stripped of trailing slashes; file://, gopher://, and http://internal-host schemes are accepted

**Exploit:** Pass sellerUrl='file:///etc/passwd' or 'http://10.0.0.1/admin'; all RPC calls and the open POST are sent there

**Fix:** Parse the URL and enforce https:// scheme; reject private/loopback IP ranges before constructing any request

### `b3b525c31d56` — If postJson to settlement_url throws after human confirms, the deal is stranded: seller sees accept, buyer has no txHash, no recovery path

**Exploit:** Seller returns a valid AcceptResponse with a settlement_url that times out after human clicks y; deal is permanently in limbo with funds potentially reserved

**Fix:** Wrap settlement POST in try/catch; on failure record the accepted deal state persistently so the buyer can retry settlement independently

### `550821deff17` — acceptResponse.payment_required.amount is used in toFixed(2) and validateOutboundOrWalk without NaN/Infinity/negative guards

**Exploit:** Seller returns payment_required:{amount:Infinity}; toFixed(2) returns 'Infinity'; validation may pass max_price check since Infinity>max_price is true but the branch depends on validateBuyerAction logic; subsequent postJson sends Infinity as amount

**Fix:** Validate that payment_required.amount is a finite positive number before any further processing

### `3bd09fbce778` — Walk is sent after AcceptResponse is already received; seller state is 'accepted' but buyer sends walk, creating irreconcilable protocol state

**Exploit:** Human declines or settlement validation fails after postRpc accept succeeds; seller has committed the deal but receives a walk; downstream reconciliation is undefined

**Fix:** Implement an explicit 'cancel-post-accept' message type or ensure walk-after-accept semantics are defined and tested in the protocol spec

### `3d734c9bea5b` — proof.txHash and proof.artifact from seller are written to transcript verbatim without newline or control-character sanitization

**Exploit:** Seller returns txHash='abc\n[Settled] txHash: attacker-controlled' or artifact containing ANSI escape codes; transcript is forged or terminal is hijacked

**Fix:** Strip or escape newlines and non-printable characters from all seller-supplied strings before appending to transcript

### `a2f853b53790` — counterResponse.terms from seller is appended to transcript and used in human confirmation summary without sanitization

**Exploit:** Seller returns terms='legit terms\n[Settled] txHash: fake'; transcript shows a fake settlement entry; human sees forged confirmation text

**Fix:** Sanitize terms (and all other seller string fields) by removing newlines and control characters before use in transcript or confirmation display

### `fa0c81cb677e` — response.json() is called without try/catch; malformed or truncated JSON body throws an uncaught TypeError that propagates out of runBuyerNegotiation

**Exploit:** Seller returns HTTP 200 with body 'not-json'; response.json() throws; exception is uncaught; deal state is abandoned mid-negotiation

**Fix:** Wrap response.json() in try/catch and throw a typed protocol error so callers can handle parse failures explicitly

### `c9997dc5b91c` — fetch has no timeout and no response-body size limit; a slow or huge seller response blocks the buyer indefinitely

**Exploit:** Seller streams a gigabyte body or stalls the response; Node.js buffers the whole body; buyer thread is blocked; memory exhaustion or indefinite hang

**Fix:** Pass an AbortSignal with a configurable timeout to fetch and enforce a max response body size before calling response.json()

### `11a30c676404` — openResponse.deal_id is used as-is with no length, charset, or format validation; path-traversal or injection payloads reach audit and RPC layers

**Exploit:** Seller returns deal_id='../../../etc/passwd' or deal_id with 10 MB string; downstream audit writer or log system is affected

**Fix:** Validate deal_id matches a strict pattern (e.g., UUID or alphanumeric â‰¤64 chars) immediately after receiving OpenResponse

### `674be3d64904` — When human declines, validateOutboundOrWalk is called for 'settle' with humanConfirmed=false; if the validator internally blocks, it fires a 'validation_denied' walk before the outer code fires a 'human_confirmation_required' walk, sending two conflicting walks

**Exploit:** Human clicks n; validateBuyerAction denies settle; sendWalk('validation_denied') fires inside validateOutboundOrWalk; caller returns early and skips the human_confirmation_required walk; protocol receives wrong reason code

**Fix:** Do not call validateOutboundOrWalk when the intent is already to walk on human denial; send a single walk with 'human_confirmation_required' directly

### `bf3f1c3a3c9b` — Return value of sendWalk is discarded at every call site; a failed or rejected walk is never detected or retried

**Exploit:** Seller drops walk messages; buyer believes it walked but seller continues treating deal as open; protocol desync is invisible to buyer

**Fix:** Await sendWalk and log or surface non-OK responses; consider retry logic for walk delivery

### `31bcb9a22a59` — Error message includes the full URL on HTTP failure, which may expose internal settlement_url values to logs or error boundaries

**Exploit:** Settlement POST fails; error 'POST http://internal-payment-service/pay?secret=xyz failed with HTTP 500' is logged or returned in API error response

**Fix:** Log the URL server-side only; return a generic error to callers that omits the raw URL

## `src/demo.ts`  (16 open)

| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |
|----|----------|--------|----------|---------|------------|----------------|
| `96d105b93a4f` | AUTHENTICATION | `module` | **High** | SELLER_PUBKEY is a hardcoded literal 'mock-seller-pubkey' providing no real cryptographic seller identity verification | abbf92d | b1bb7e3 |
| `c0ba1b58e3f0` | SSRF | `main` | **High** | SELLER_URL env var is passed to runBuyerNegotiation without scheme or host validation, enabling SSRF to internal services | abbf92d | b1bb7e3 |
| `48115d73de95` | RACE_CONDITION | `main` | **Medium** | runBuyerNegotiation is called immediately after app.listen() without awaiting the 'listening' event, so the first request can arrive before the socket is bound | abbf92d | b1bb7e3 |
| `b1c68694adf7` | INPUT_VALIDATION | `module` | **Medium** | PORT env var is cast with Number() but never range-validated; NaN, 0, negative, or >65535 values silently reach app.listen() | abbf92d | b1bb7e3 |
| `6063e253d618` | BUSINESS_LOGIC | `main` | **Medium** | opening_offer is hardcoded at 4 while target_price is Math.min(4,maxPrice); when maxPrice<4 the buyer opens above their own price ceiling | abbf92d | b1bb7e3 |
| `2c3d2dc31158` | LOG_INJECTION | `askForHumanConfirmation` | **Medium** | summary string (built from seller data) is written directly to terminal via rl.question, enabling terminal escape injection | b1bb7e3 | b1bb7e3 |
| `11944b9ea7fd` | SILENT_FAILURE | `main` | **Medium** | app.listen() result is not monitored for errors; port-bind failures are silently swallowed until the negotiation attempt fails | b1bb7e3 | b1bb7e3 |
| `9d9225d16ad6` | DOS | `main` | **Medium** | server.close() in finally block hangs indefinitely if the buyer agent holds an open keep-alive connection | b1bb7e3 | b1bb7e3 |
| `e10fdf486bd5` | REPLAY_ATTACK | `main` | **Medium** | Mock public key and absence of real signature verification mean any recorded negotiation message can be replayed | b1bb7e3 | b1bb7e3 |
| `040cab2f40b6` | LOG_INJECTION | `main` | **Low** | result.txHash and result.artifact from the external seller server are interpolated directly into console.log without sanitization | abbf92d | b1bb7e3 |
| `e6bc1886ee61` | STATE_VIOLATION | `main` | **Low** | Local seller server is unconditionally started even when SELLER_URL env var overrides the endpoint, wasting a port binding and running a live HTTP service unnecessarily | abbf92d | abbf92d |
| `2d8b254022b1` | PARTIAL_FAILURE | `main` | **Low** | If server.close() rejects inside the finally block, it throws and replaces any in-flight negotiation error, making the root cause invisible | abbf92d | abbf92d |
| `2e00f135e9cc` | INFO_DISCLOSURE | `module` | **Low** | When a non-Error rejection reaches the top-level catch, the raw value is passed to console.error, potentially printing internal objects with sensitive fields | abbf92d | abbf92d |
| `bef8167ce153` | DOS | `askForHumanConfirmation` | **Low** | readline.question has no timeout; process blocks indefinitely on stdin waiting for human confirmation | b1bb7e3 | b1bb7e3 |
| `71a07d643898` | NUMERIC_EDGE_CASE | `main` | **Low** | BUYER_MAX_PRICE accepts arbitrarily large finite values (e.g., 1e308) with no upper bound check | b1bb7e3 | b1bb7e3 |
| `c6c93006f410` | INFO_DISCLOSURE | `main` | **Low** | Seller's minimum (floor) price is logged to the shared console, visible to the buyer process and any log aggregator | b1bb7e3 | b1bb7e3 |

### `96d105b93a4f` — SELLER_PUBKEY is a hardcoded literal 'mock-seller-pubkey' providing no real cryptographic seller identity verification

**Exploit:** Any server at SELLER_URL trivially passes pubkey checks because the expected key is always the well-known string 'mock-seller-pubkey'; a MitM or rogue seller is indistinguishable from the legitimate one

**Fix:** Load seller pubkey from a secure env var or config file and verify TLS/message signatures against the real key

### `c0ba1b58e3f0` — SELLER_URL env var is passed to runBuyerNegotiation without scheme or host validation, enabling SSRF to internal services

**Exploit:** SELLER_URL=http://169.254.169.254/latest/meta-data/ in a cloud environment causes the buyer agent to exfiltrate instance metadata credentials

**Fix:** Validate SELLER_URL against an allowlist of permitted schemes and hostnames before passing it to the negotiation function

### `48115d73de95` — runBuyerNegotiation is called immediately after app.listen() without awaiting the 'listening' event, so the first request can arrive before the socket is bound

**Exploit:** On a loaded system the buyer agent's first HTTP request races the TCP bind and receives ECONNREFUSED, causing the negotiation to fail non-deterministically

**Fix:** Wrap app.listen() in a promise that resolves on the 'listening' event and await it before calling runBuyerNegotiation

### `b1c68694adf7` — PORT env var is cast with Number() but never range-validated; NaN, 0, negative, or >65535 values silently reach app.listen()

**Exploit:** PORT=abc yields SELLER_PORT=NaN and sellerUrl='http://localhost:NaN'; PORT=99999 is an invalid port; both produce silent misconfiguration or an unhandled listen error

**Fix:** After parsing, assert Number.isInteger(SELLER_PORT) && SELLER_PORT >= 1 && SELLER_PORT <= 65535 and throw a descriptive error otherwise

### `6063e253d618` — opening_offer is hardcoded at 4 while target_price is Math.min(4,maxPrice); when maxPrice<4 the buyer opens above their own price ceiling

**Exploit:** BUYER_MAX_PRICE=3 â†’ target_price=3 but strategy.opening_offer=4; the buyer's first bid exceeds their stated maximum, violating their own mandate

**Fix:** Derive opening_offer dynamically as Math.min(4, maxPrice) so it never exceeds the buyer's ceiling

### `2c3d2dc31158` — summary string (built from seller data) is written directly to terminal via rl.question, enabling terminal escape injection

**Exploit:** Seller crafts a proposal summary containing ANSI sequences (e.g., \x1b[2J) to clear screen or spoof UI elements

**Fix:** Strip ANSI escape codes and control characters from summary before displaying to terminal

### `11944b9ea7fd` — app.listen() result is not monitored for errors; port-bind failures are silently swallowed until the negotiation attempt fails

**Exploit:** Set PORT=80 (privileged); server silently fails to bind; buyer connects to nothing or a different service on that port

**Fix:** Attach an 'error' event listener on server and reject/throw so startup failure is surfaced immediately

### `9d9225d16ad6` — server.close() in finally block hangs indefinitely if the buyer agent holds an open keep-alive connection

**Exploit:** runBuyerNegotiation leaves an HTTP keep-alive socket open; server.close() never calls back; process hangs forever

**Fix:** Call server.closeAllConnections() (Node â‰¥18) before server.close(), or set a hard timeout that calls server.destroy()

### `e10fdf486bd5` — Mock public key and absence of real signature verification mean any recorded negotiation message can be replayed

**Exploit:** Capture a valid accepted-offer message and replay it to trigger re-settlement at the same price without fresh consent

**Fix:** Implement nonce/timestamp-based message signing verified against a real seller public key; reject replayed nonces

### `040cab2f40b6` — result.txHash and result.artifact from the external seller server are interpolated directly into console.log without sanitization

**Exploit:** Seller returns txHash containing '\n[Settled] FAKE_ENTRY\n[Admin] payment-redirected' to inject spurious log lines that deceive operators or downstream log parsers

**Fix:** Strip or encode newlines and control characters from externally-sourced strings before interpolating them into log messages

### `e6bc1886ee61` — Local seller server is unconditionally started even when SELLER_URL env var overrides the endpoint, wasting a port binding and running a live HTTP service unnecessarily

**Exploit:** Set SELLER_URL to an external endpoint; the local server still binds SELLER_PORT, accepts connections, and processes requests even though the buyer never talks to it

**Fix:** Conditionally start the local server only when SELLER_URL is not set in the environment

### `2d8b254022b1` — If server.close() rejects inside the finally block, it throws and replaces any in-flight negotiation error, making the root cause invisible

**Exploit:** A negotiation failure followed by a server close error causes the outer catch to see only the server close error; the original business failure is lost and process.exitCode may be set for the wrong reason

**Fix:** Catch the server.close() rejection independently (e.g., with .catch(console.error)) so it never masks the primary exception

### `2e00f135e9cc` — When a non-Error rejection reaches the top-level catch, the raw value is passed to console.error, potentially printing internal objects with sensitive fields

**Exploit:** A rejected promise carrying {apiKey:'sk-live-...', status:'failed'} prints the full object to stderr where it may be captured by log aggregators

**Fix:** Always serialize unknown thrown values safely: String(error) or JSON.stringify with a replacer that redacts known sensitive keys

### `bef8167ce153` — readline.question has no timeout; process blocks indefinitely on stdin waiting for human confirmation

**Exploit:** Automated or headless environment where stdin is closed/empty causes the process to hang until killed externally

**Fix:** Race rl.question against a timeout Promise; reject and close the interface if no answer arrives within a reasonable deadline

### `71a07d643898` — BUYER_MAX_PRICE accepts arbitrarily large finite values (e.g., 1e308) with no upper bound check

**Exploit:** BUYER_MAX_PRICE=1e308 passes isFinite and >0 checks; downstream arithmetic may overflow or produce nonsensical offers

**Fix:** Add an upper-bound sanity check (e.g., maxPrice <= 1_000_000) appropriate to the currency denomination

### `c6c93006f410` — Seller's minimum (floor) price is logged to the shared console, visible to the buyer process and any log aggregator

**Exploit:** console.log discloses min_price=4.5; a buyer reading combined stdout learns the seller's true reservation price before negotiating

**Fix:** Keep seller-side policy details out of shared console output; log them only to a seller-specific log stream or omit floor price

## `src/heuristics.ts`  (1 open)

| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |
|----|----------|--------|----------|---------|------------|----------------|
| `1119fb0c927c` | INPUT_VALIDATION | `module` | **Info** | No vulnerabilities found | abbf92d | abbf92d |

### `1119fb0c927c` — No vulnerabilities found

**Exploit:** â€”

**Fix:** â€”

## `src/schemas.ts`  (8 open)

| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |
|----|----------|--------|----------|---------|------------|----------------|
| `ce37a6aa96f0` | INPUT_VALIDATION | `parseOpenRequest` | **Critical** | Stub always throws; no validation ever executes, any input passes type-cast unsanitized if caller catches the error | abbf92d | abbf92d |
| `5d60bb2827cb` | INPUT_VALIDATION | `parseCounterRequest` | **Critical** | Same stub failure â€” CounterRequest validation never runs | abbf92d | abbf92d |
| `724980e82e99` | INPUT_VALIDATION | `parseAcceptRequest` | **Critical** | Same stub failure â€” AcceptRequest validation never runs | abbf92d | abbf92d |
| `671def533296` | INPUT_VALIDATION | `parseWalkRequest` | **Critical** | Same stub failure â€” WalkRequest validation never runs | abbf92d | abbf92d |
| `b2b7018f2bb5` | INPUT_VALIDATION | `parseStatusRequest` | **Critical** | Same stub failure â€” StatusRequest validation never runs | abbf92d | abbf92d |
| `634b11ec2a79` | UNHANDLED_EXCEPTION | `module` | **High** | All parse functions unconditionally throw; any caller without explicit error handling will crash the process | abbf92d | abbf92d |
| `f53f364fda12` | STATE_VIOLATION | `module` | **High** | Stub functions make the system appear functional at compile time but are permanently broken at runtime, violating the contract between Developer 1 and consuming code | abbf92d | abbf92d |
| `dc53a2d7eafb` | INFO_DISCLOSURE | `module` | **Low** | Error message exposes internal developer ownership model ('Developer 1') and file structure to any caller who surfaces the raw exception message | abbf92d | abbf92d |

### `ce37a6aa96f0` — Stub always throws; no validation ever executes, any input passes type-cast unsanitized if caller catches the error

**Exploit:** Caller wraps in try/catch and falls back to raw cast: the thrown error is swallowed and untrusted data flows downstream as OpenRequest

**Fix:** Implement full Zod/ajv schema validation before the function is deployed; block deployment of stub in production via CI gate

### `5d60bb2827cb` — Same stub failure â€” CounterRequest validation never runs

**Exploit:** Same catch-and-cast pattern against raw untrusted input

**Fix:** Implement validation; add pre-deployment CI check that stubs are replaced

### `724980e82e99` — Same stub failure â€” AcceptRequest validation never runs

**Exploit:** Same catch-and-cast pattern against raw untrusted input

**Fix:** Implement validation; add pre-deployment CI check that stubs are replaced

### `671def533296` — Same stub failure â€” WalkRequest validation never runs

**Exploit:** Same catch-and-cast pattern against raw untrusted input

**Fix:** Implement validation; add pre-deployment CI check that stubs are replaced

### `b2b7018f2bb5` — Same stub failure â€” StatusRequest validation never runs

**Exploit:** Same catch-and-cast pattern against raw untrusted input

**Fix:** Implement validation; add pre-deployment CI check that stubs are replaced

### `634b11ec2a79` — All parse functions unconditionally throw; any caller without explicit error handling will crash the process

**Exploit:** Call any parse function without try/catch in an async Express route handler â€” unhandled promise rejection crashes or hangs the server

**Fix:** Implement functions; document throwing contract; ensure all call sites wrap in try/catch or use a centralized error boundary

### `f53f364fda12` — Stub functions make the system appear functional at compile time but are permanently broken at runtime, violating the contract between Developer 1 and consuming code

**Exploit:** Deploy to staging/prod before Developer 1 delivers; every negotiation endpoint becomes a 500 with no useful error to the client

**Fix:** Add a TODO-blocking lint rule or integration test that fails CI if any parse function still throws 'not implemented'

### `dc53a2d7eafb` — Error message exposes internal developer ownership model ('Developer 1') and file structure to any caller who surfaces the raw exception message

**Exploit:** Trigger any parse call, catch the Error, and return error.message directly in an API response â€” leaks team/file internals

**Fix:** Use a generic 'not implemented' message without internal attribution; strip raw error messages from API responses

## `src/seller-server.ts`  (1 open)

| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |
|----|----------|--------|----------|---------|------------|----------------|
| `1558d370b3d1` | INPUT_VALIDATION | `module` | **Info** | No vulnerabilities found | abbf92d | abbf92d |

### `1558d370b3d1` — No vulnerabilities found

**Exploit:** â€”

**Fix:** â€”

## `src/types.ts`  (18 open)

| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |
|----|----------|--------|----------|---------|------------|----------------|
| `96009440883c` | REPLAY_ATTACK | `NuffEnvelope` | **Critical** | expires_at is optional; omitting it produces a signed envelope valid forever, enabling indefinite replay | abbf92d | abbf92d |
| `6d4884b81cc7` | AUTHENTICATION | `NuffEnvelope` | **Critical** | signature is an untyped string with no algorithm binding; empty string or algorithm-confusion attacks are type-valid | abbf92d | abbf92d |
| `5c6459faaf72` | BUSINESS_LOGIC | `AcceptResponse` | **Critical** | payment_required.pay_to is an unvalidated string; seller can substitute an arbitrary or attacker-controlled address | abbf92d | abbf92d |
| `22ef6ded9f1e` | INFO_DISCLOSURE | `BuyerAuditEntry` | **High** | cap field in audit log exposes buyer's maximum price; if logs reach the seller, BATNA is fully revealed | abbf92d | abbf92d |
| `e385920809f9` | INFO_DISCLOSURE | `SellerAuditEntry` | **High** | floor field in audit log exposes seller's minimum price; buyer learning it can offer exactly floor and extract maximum surplus | abbf92d | abbf92d |
| `b6290722dca0` | SSRF | `AcceptResponse` | **High** | settlement_url is an unconstrained string; seller can return internal network or metadata-service URLs | abbf92d | abbf92d |
| `0525c246fb53` | NUMERIC_EDGE_CASE | `BuyerIntent` | **High** | max_price, target_price, and all number price fields accept NaN and Infinity; NaN poisons all comparisons silently | abbf92d | abbf92d |
| `59c4101b651f` | BUSINESS_LOGIC | `SellerStrategy` | **High** | No type constraint that floor_price <= preferred_price <= opening_ask; inverted values produce irrational seller behaviour | abbf92d | abbf92d |
| `9023246fac39` | BUSINESS_LOGIC | `AcceptRequest` | **High** | accepted_price is unconstrained; buyer can accept at a price never offered, including 0 or negative | abbf92d | abbf92d |
| `e5b436725f8e` | NUMERIC_EDGE_CASE | `NuffEnvelope` | **Medium** | round: number accepts negative values and non-integers, breaking the round-based state machine | abbf92d | abbf92d |
| `e8999ffa062b` | BUSINESS_LOGIC | `BuyerIntent` | **Medium** | require_human_confirmation_above accepts 0 or negative, making every transaction trigger human confirmation, or can be set to Infinity to bypass all confirmations | abbf92d | abbf92d |
| `9daac9481546` | PARTIAL_FAILURE | `BuyerIntent` | **Medium** | allow_partial_match:true is expressible but OpenResponse and AcceptResponse have no quantity_filled field; partial fills are silently undetectable | abbf92d | abbf92d |
| `46833b646d96` | LOG_INJECTION | `WalkRequest` | **Medium** | note is a free-form string with no length or character restrictions; can inject CRLF or structured-log tokens | abbf92d | abbf92d |
| `b92ad5df9e93` | LOG_INJECTION | `OpenRequest` | **Medium** | intent_summary is an unbounded string that may be written verbatim to logs, enabling log forging | abbf92d | abbf92d |
| `2066e42719ec` | STATE_VIOLATION | `DealPhase` | **Medium** | DealPhase is a plain union with no transition table; type system permits arbitrary phase jumps (open -> settled) | abbf92d | abbf92d |
| `56f51c7367a2` | DOS | `BuyerIntent` | **Medium** | max_rounds: number accepts Infinity or MAX_SAFE_INTEGER, enabling unbounded negotiation loops | abbf92d | abbf92d |
| `e0903bf44239` | SILENT_FAILURE | `OpenResponse` | **Medium** | accepted:false with reason_code optional means rejections can carry no actionable information | abbf92d | abbf92d |
| `df4413d14672` | INPUT_VALIDATION | `NuffEnvelope` | **Low** | timestamp and expires_at are untyped strings with no ISO-8601 format enforcement; malformed or past dates are type-valid | abbf92d | abbf92d |

### `96009440883c` — expires_at is optional; omitting it produces a signed envelope valid forever, enabling indefinite replay

**Exploit:** Send a NuffEnvelope without expires_at; the signature remains valid and the message can be re-submitted at any future time

**Fix:** Make expires_at required and enforce a maximum validity window at parse time

### `6d4884b81cc7` — signature is an untyped string with no algorithm binding; empty string or algorithm-confusion attacks are type-valid

**Exploit:** Submit signature:"" or switch signing algorithm (e.g. HMAC-SHA256 instead of Ed25519); no field rejects either

**Fix:** Add a required sig_alg field with a locked literal type (e.g. "ed25519") and reject empty signatures at validation boundary

### `5c6459faaf72` — payment_required.pay_to is an unvalidated string; seller can substitute an arbitrary or attacker-controlled address

**Exploit:** Seller returns pay_to:"0xattacker" or pay_to:""; buyer's agent pays the wrong address with no type-level rejection

**Fix:** Constrain pay_to with a branded type or regex pattern enforced at the validation boundary (e.g. EIP-55 checksum address)

### `22ef6ded9f1e` — cap field in audit log exposes buyer's maximum price; if logs reach the seller, BATNA is fully revealed

**Exploit:** Seller reads audit log entries (e.g. via shared storage, log aggregator, or compromised log pipeline) and learns cap, then demands exactly that price in every counter

**Fix:** Remove cap from the exported audit type or replace it with a boolean hit_cap; store the raw value only in a buyer-private log

### `e385920809f9` — floor field in audit log exposes seller's minimum price; buyer learning it can offer exactly floor and extract maximum surplus

**Exploit:** Buyer reads SellerAuditEntry (e.g. via shared log storage) and learns floor, then makes a take-it-or-leave-it offer at floor+1

**Fix:** Remove floor from the exported audit type or replace with a boolean at_floor boolean flag

### `b6290722dca0` — settlement_url is an unconstrained string; seller can return internal network or metadata-service URLs

**Exploit:** Seller sets settlement_url:"http://169.254.169.254/latest/meta-data/" ; buyer agent fetches it, leaking cloud credentials

**Fix:** Validate settlement_url at parse time against an allowlist of schemes/hosts; reject non-HTTPS or RFC-1918 targets

### `0525c246fb53` — max_price, target_price, and all number price fields accept NaN and Infinity; NaN poisons all comparisons silently

**Exploit:** Send max_price:NaN; every guard of the form price <= max_price evaluates to false, bypassing the cap entirely

**Fix:** Add a branded PositiveFiniteNumber type validated at ingress with Number.isFinite(v) && v > 0

### `59c4101b651f` — No type constraint that floor_price <= preferred_price <= opening_ask; inverted values produce irrational seller behaviour

**Exploit:** Set floor_price:1000, opening_ask:1; seller accepts any offer above 1 but will never walk even below floor

**Fix:** Add a runtime invariant check (or Zod refinement) asserting floor_price <= preferred_price <= opening_ask

### `9023246fac39` — accepted_price is unconstrained; buyer can accept at a price never offered, including 0 or negative

**Exploit:** Send AcceptRequest with accepted_price:0 after a negotiation; type system does not prevent accepting at an off-protocol price

**Fix:** Validate accepted_price matches the last counter price on record before processing the accept

### `e5b436725f8e` — round: number accepts negative values and non-integers, breaking the round-based state machine

**Exploit:** Send round:-1 or round:0.5; state machine comparisons behave unexpectedly, potentially allowing out-of-order processing

**Fix:** Validate that round is a non-negative integer (Number.isInteger && v >= 0) at envelope parse time

### `e8999ffa062b` — require_human_confirmation_above accepts 0 or negative, making every transaction trigger human confirmation, or can be set to Infinity to bypass all confirmations

**Exploit:** Set require_human_confirmation_above:-1 to gate every single micro-payment on human approval, or Infinity to silently skip confirmation on any amount

**Fix:** Validate that require_human_confirmation_above is a positive finite number when present

### `9daac9481546` — allow_partial_match:true is expressible but OpenResponse and AcceptResponse have no quantity_filled field; partial fills are silently undetectable

**Exploit:** Seller accepts a partial quantity (e.g. 3 of 10 units) but the response type carries no quantity field; buyer agent pays full amount for partial delivery

**Fix:** Add quantity_filled: number to OpenResponse and AcceptResponse, required when allow_partial_match is true

### `46833b646d96` — note is a free-form string with no length or character restrictions; can inject CRLF or structured-log tokens

**Exploit:** Send note:"\n2026-01-01 INFO deal accepted price=0" to forge a fake audit log entry in newline-delimited log systems

**Fix:** Sanitize or reject note values containing CR/LF/NUL at validation boundary; enforce a max length (e.g. 256 chars)

### `b92ad5df9e93` — intent_summary is an unbounded string that may be written verbatim to logs, enabling log forging

**Exploit:** Send intent_summary containing CRLF sequences or JSON-breaking characters to inject false log lines

**Fix:** Sanitize intent_summary at ingress; strip control characters and enforce a maximum length

### `2066e42719ec` — DealPhase is a plain union with no transition table; type system permits arbitrary phase jumps (open -> settled)

**Exploit:** Construct a StatusResponse with phase:"settled" for a deal still in phase:"open"; no type guard prevents illegal transitions

**Fix:** Enforce a state transition map at runtime (e.g. allowedTransitions[current].includes(next)) before mutating phase

### `56f51c7367a2` — max_rounds: number accepts Infinity or MAX_SAFE_INTEGER, enabling unbounded negotiation loops

**Exploit:** Set max_rounds:Infinity; negotiation agent loops forever without terminating, exhausting compute or API budget

**Fix:** Validate max_rounds is a positive integer within a reasonable ceiling (e.g. <= 100) at ingress

### `e0903bf44239` — accepted:false with reason_code optional means rejections can carry no actionable information

**Exploit:** Seller returns {accepted:false} with no reason_code or counter_price; buyer agent has no basis to counter and may silently walk

**Fix:** Make reason_code required when accepted is false, using a discriminated union: {accepted:false; reason_code: string}

### `df4413d14672` — timestamp and expires_at are untyped strings with no ISO-8601 format enforcement; malformed or past dates are type-valid

**Exploit:** Send timestamp:"not-a-date"; downstream Date.parse returns NaN, making expiry and ordering checks silently incorrect

**Fix:** Use a branded ISODateString type validated with a strict regex or Date.parse check at ingress

## `src/validation.ts`  (6 open)

| ID | Category | Anchor | Severity | Summary | First Seen | Last Confirmed |
|----|----------|--------|----------|---------|------------|----------------|
| `426d75bd6ea4` | BUSINESS_LOGIC | `module` | **Critical** | Entire validation layer is unimplemented; all buyer and seller actions are unvalidated | abbf92d | abbf92d |
| `f3a67a6c360b` | UNHANDLED_EXCEPTION | `validateBuyerAction` | **High** | Unconditional throw propagates uncaught exception to every caller | abbf92d | abbf92d |
| `aa00da034c2f` | UNHANDLED_EXCEPTION | `validateSellerAction` | **High** | Unconditional throw propagates uncaught exception to every caller | abbf92d | abbf92d |
| `3134027b9e56` | STATE_VIOLATION | `validateBuyerAction` | **High** | humanConfirmed flag is never checked; human-in-the-loop invariant can be silently violated | abbf92d | abbf92d |
| `cb9a4d33d2b5` | INFO_DISCLOSURE | `validateBuyerAction` | **Medium** | Error message leaks internal file path and developer identity | abbf92d | abbf92d |
| `ce26dedccb07` | INFO_DISCLOSURE | `validateSellerAction` | **Medium** | Same internal-detail leak in seller validation error message | abbf92d | abbf92d |

### `426d75bd6ea4` — Entire validation layer is unimplemented; all buyer and seller actions are unvalidated

**Exploit:** Any production deployment of this stub allows price, quantity, and action values to flow through with zero enforcement â€” negative prices, zero quantities, or unauthorized actions are never rejected

**Fix:** Block deployment until both functions are fully implemented and return real ValidationResult values

### `f3a67a6c360b` — Unconditional throw propagates uncaught exception to every caller

**Exploit:** Call validateBuyerAction with any arguments; callers lacking try/catch will crash or expose an unhandled-rejection stack trace

**Fix:** Return a ValidationResult stub or guard callers; never ship an unconditional throw on a hot validation path

### `aa00da034c2f` — Unconditional throw propagates uncaught exception to every caller

**Exploit:** Call validateSellerAction with any arguments; same crash vector as validateBuyerAction

**Fix:** Same as above â€” return a safe default or remove the export until implemented

### `3134027b9e56` — humanConfirmed flag is never checked; human-in-the-loop invariant can be silently violated

**Exploit:** Pass humanConfirmed=false for a high-value 'accept' or 'settle' action â€” stub throws before enforcing the flag, so any error-swallowing middleware allows the action to proceed without human approval

**Fix:** Implement an explicit guard: if (!humanConfirmed && ['accept','settle'].includes(action)) return {valid:false, reason:'requires human confirmation'}

### `cb9a4d33d2b5` — Error message leaks internal file path and developer identity

**Exploit:** Trigger the throw and capture the Error.message â€” 'validation.ts: not implemented by Developer 1 yet' reveals internal architecture and team structure

**Fix:** Use a generic opaque message such as 'Service temporarily unavailable' or an error code

### `ce26dedccb07` — Same internal-detail leak in seller validation error message

**Exploit:** Same as above

**Fix:** Same â€” use an opaque error message
