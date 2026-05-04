# BidMesh YC Demo Script

## One-Liner

Your AI agent can negotiate autonomously, but it can never spend more than the human authorized.

## Setup

Commands:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' run build
& 'C:\nvm4w\nodejs\npm.cmd' test
```

Expected current status:

- Build passes.
- Tests pass.
- `npm run demo` is blocked until Developer 1 implements the seller server, validation, heuristics, and audit modules.

## Run 1: Human Declines Payment

Command:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' run demo
```

At confirmation:

```text
n
```

Narration:

```text
The buyer agent negotiated autonomously, but settlement still requires explicit human approval. When I decline, the buyer walks and no mock payment is initiated.
```

Expected final behavior after Developer 1 implementation:

- Transcript shows buyer/seller negotiation.
- Confirmation prompt includes final price and delivery terms.
- Human enters `n`.
- Buyer walks.
- No settlement tx hash is printed.

## Run 2: Human Confirms Payment

Command:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' run demo
```

At confirmation:

```text
y
```

Narration:

```text
Same policy, same guardrails. This time I approve the final price, so the buyer settles with a mock x402 receipt and returns a proof artifact.
```

Expected final behavior after Developer 1 implementation:

- Transcript shows buyer opening, seller counter, buyer counter, and seller acceptance.
- Confirmation prompt appears before payment.
- Human enters `y`.
- Demo prints mock tx hash.
- Demo prints proof artifact.
- Demo prints final deal JSON.

## Safety Proof

Run the forced over-cap test:

```powershell
& 'C:\nvm4w\nodejs\npm.cmd' test
```

Narration:

```text
The important test mutates the buyer to open at 7 USDC with a 5 USDC max. The HTTP seller receives zero requests, and the buyer writes a blocked audit entry. The cap is enforced before the message leaves the buyer.
```

## Current Blocker

The live demo currently stops with:

```text
[Blocked] Demo runtime is waiting on Developer 1 core/server implementations.
seller-server.ts: not implemented by Developer 1 yet
```

This is expected until Developer 1 replaces the stubs in:

- `src/seller-server.ts`
- `src/validation.ts`
- `src/heuristics.ts`
- `src/audit.ts`

