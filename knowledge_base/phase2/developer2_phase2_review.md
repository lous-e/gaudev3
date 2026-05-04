# Developer 2 Phase 2 Review

Primary plan:

- `knowledge_base/TWO_DEVELOPER_PLAN.md`

Reference plan:

- `knowledge_base/plan.md`

Reviewed files:

- `src/buyer-agent.ts`
- `knowledge_base/phase2/developer2_phase2_changes.md`

## Findings

None after follow-up fixes.

The first Phase 2 review found three issues:

1. Over-cap opening offers were silently clamped before validation.
2. Seller structured walk responses from `bidmesh.negotiate.accept` were not handled.
3. Human-denied settlement walked without exercising the buyer validation shim.

Those issues were fixed before this final review document was written.

## Fixed Review Findings

### Over-cap opening offer handling

Status: fixed.

`getOpeningOffer(...)` now returns the attempted `strategy.opening_offer` unchanged. `buildOpenEnvelope(...)` uses that value as `initial_offer`, and `runBuyerNegotiation(...)` validates `skeleton.openingOffer` before posting `/rpc`.

Relevant locations:

- `src/buyer-agent.ts:74`
- `src/buyer-agent.ts:103`
- `src/buyer-agent.ts:115`
- `src/buyer-agent.ts:535`

This means a forced over-cap opening attempt can be blocked and audited by `validateBuyerAction(...)` instead of being silently normalized.

### Seller walk response from accept

Status: fixed.

`acceptAndMaybeSettle(...)` now posts accept as:

```ts
AcceptResponse | WalkResponse
```

It checks `isAcceptResponse(...)` before reading payment fields. If the response is not a real accept response, the buyer returns a walked result.

Relevant locations:

- `src/buyer-agent.ts:353`
- `src/buyer-agent.ts:397`
- `src/buyer-agent.ts:409`

### Human-denied settlement validation

Status: fixed.

The human-denied branch now calls:

```ts
validateOutboundOrWalk({
  action: "settle",
  humanConfirmed: false,
  ...
})
```

before returning/walking. `validateOutboundOrWalk(...)` calls `validateBuyerAction(...)`, writes a blocked buyer audit entry on denial, and sends a validation-denied walk when a real deal id exists.

Relevant locations:

- `src/buyer-agent.ts:267`
- `src/buyer-agent.ts:277`
- `src/buyer-agent.ts:288`
- `src/buyer-agent.ts:296`
- `src/buyer-agent.ts:431`

## Checklist Compliance

| Requirement | Status | Notes |
|---|---|---|
| Buyer-side `/rpc` calls exist | Pass | Open, counter, accept, and walk use `postRpc(...)`. |
| Settlement call exists | Pass | Settlement posts through `postJson(...)` to `acceptResponse.settlement_url`. |
| Outbound priced buyer actions are gated | Pass | Open, counter, accept, and settle go through `validateOutboundOrWalk(...)`. |
| Blocked buyer audit entries are written before validation-denied walks | Pass | `writeBlockedAudit(...)` is called on validation denial. |
| Human confirmation branch exists before settlement | Pass | `askForHumanConfirmation(...)` runs before settlement. |
| Developer 1 files were not implemented here | Pass | Developer 1-owned files remain stubs. |
| Demo/test work deferred | Pass | No demo or integration test changes were made in this phase. |

## Verification

Build was verified with:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' run build
```

Observed output:

```text
> bidmesh-negotiate@1.0.0 build
> tsc
```

Exit code: `0`.

## Developer 1 Stub Blockers

These are not Developer 2 Phase 2 issues, but they block runtime verification:

- `validateBuyerAction(...)` and `validateSellerAction(...)` are Developer 1 stubs.
- `writeBuyerAudit(...)` and `writeSellerAudit(...)` are Developer 1 stubs.
- `decideBuyerMove(...)`, `nextBuyerCounter(...)`, and seller heuristics are Developer 1 stubs.
- `createSellerServer(...)` is a Developer 1 stub.

## Residual Risks

- Runtime behavior cannot be proven until Developer 1 replaces the stubs above.
- No tests currently exercise the fixed paths.
- Response parsing is still TypeScript-cast based after `fetch`; runtime schema validation is not wired into the buyer path.
- Opening envelopes still use `deal_id: "pending"` because `NuffEnvelope<TBody>` currently requires `deal_id`.

## Overall Assessment

Approved for Developer 2 Phase 2.

The Hour 2 buyer-agent scope is satisfied: buyer-side HTTP calls exist, outbound priced actions pass through validation, blocked audit plumbing exists, the human confirmation branch is in place before settlement, and the known review blockers were fixed.
