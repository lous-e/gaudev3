---
name: bidmesh-negotiate
description: >
  Agent-to-agent price negotiation with human-guardrailed spend caps.
  Buyer and seller agents settle a deal autonomously within human-defined
  policy limits. No LLM call can exceed the buyer's max_price or the
  seller's min_price.
version: 1.0.0
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npx
    envVars:
      - name: SELLER_URL
        required: false
        description: URL of the seller negotiation server (default localhost:3001)
      - name: BUYER_MAX_PRICE
        required: false
        description: Override max price at runtime
---

# BidMesh Negotiate

A deterministic price-negotiation skill for OpenClaw agents.

## What This Skill Does

- Extracts a BuyerIntent from natural language and confirms it with the human
- Runs a capped negotiation loop against a NuffV1-compatible seller endpoint
- Blocks any offer, counter, or acceptance that exceeds the human-set spend cap
- Requires human confirmation before any payment settlement
- Produces an append-only audit log of every action

## Usage

Install and run the demo:

```bash
clawhub install bidmesh-negotiate
npm install && npm run demo
```

## Key Guarantees

1. The agent cannot spend above `max_price`. This is enforced by a pure
   validation shim that runs before every outbound call, not by an LLM
   instruction.
2. No payment is initiated without explicit human confirmation unless
   `require_human_confirmation_before_payment` is explicitly false.
3. Every blocked action is written to `buyer/workspace/memory/audit.log`.

## Protocol

Uses NuffV1: JSON-RPC over HTTPS with methods:

- `bidmesh.negotiate.open`
- `bidmesh.negotiate.counter`
- `bidmesh.negotiate.accept`
- `bidmesh.negotiate.walk`
- `bidmesh.negotiate.status`

See `src/types.ts` for full TypeScript definitions.
