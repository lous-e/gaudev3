# BidMesh YC Demo Script

## Goal

Show one thing clearly:

Your AI agent can negotiate on its own, but it cannot spend outside the limits the human set.

## Demo Setup

Run:

```powershell
npm run demo:backend
```

Open:

- `http://localhost:3002/ui/human`
- `http://localhost:3002/ui/agent`

Recording layout:

- Put the human view on the left
- Put the agent view on the right
- Keep browser zoom high enough that text is legible in a YC video

## Recommended Runtime

- Total length: `75-90 seconds`
- One take if possible
- No terminal setup in the main recording
- Start with both UI pages already open

## Shot List

### 1. Open With The Product

Screen:

- Human view on `Deals`
- Agent view on `session`

Voiceover:

```text
BidMesh is a trust and negotiation layer for agent-to-agent commerce.
The buyer’s agent can negotiate autonomously, but it can never spend more than the human authorized.
```

What to point at:

- Human dashboard headline
- Agent terminal-style live session
- The fact that both surfaces exist at once

### 2. Show The Marketplace

Screen:

- In the human view, stay on `Deals`
- Scroll slightly if needed to show seeded sellers

Voiceover:

```text
On the left is the human control surface.
On the right is the machine-readable agent surface.
The human sets intent and budget, and the agent handles discovery and negotiation.
```

What to do:

- Briefly hover over a few seller cards
- Do not over-explain the whole page

### 3. Create A Live Deal

Screen action:

- Click `+ New intent`
- Choose a seeded seller like `cableworks.agent`
- Leave item as `USB-C cable`
- Set `Target price` to `4`
- Set `Max price` to `5`
- Click `Start negotiation`

Voiceover:

```text
I’m telling my agent to buy a USB-C cable.
My target is 4 USDC, and my hard cap is 5 USDC.
That cap becomes a deterministic guardrail, not just a suggestion to the model.
```

### 4. Show The Negotiation Happen Live

Screen:

- Human view switches to the live deal page
- Agent view updates to the same session

Voiceover:

```text
Now the agent starts negotiating automatically.
The seller counters, the buyer responds, and both interfaces update from the same live backend event stream.
```

What to point at:

- Human current offer card
- Transcript in the human view
- JSON-like transcript in the agent view
- Matching `deal_id` or phase between both sides

### 5. Show Human Approval At The Last Responsible Moment

Wait for:

- Human page shows `Awaiting your confirmation`

Voiceover:

```text
The human is not in the loop for every message.
They are only pulled in at the last responsible moment, right before payment.
```

Screen action:

- Click `Confirm & pay`

Voiceover:

```text
Once I approve, the deal settles and the system records a mock payment receipt and proof artifact.
```

### 6. Show The Settlement Outcome

Screen:

- Human page shows settled state
- Agent page shows the settled event in the transcript

Voiceover:

```text
So the agent gets autonomy over negotiation, but the user still controls spend.
That’s the core trust model.
```

What to point at:

- Settled badge
- Receipt info on the human page
- `deal.settled` or `settlement.mocked` in the agent stream

### 7. Show The Safety Moment

Screen action:

- Start a second deal or stay on a live one before approval
- Click `Force over-cap test`

Voiceover:

```text
Here’s the important part.
If the agent tries to go over the human’s cap, the validation shim blocks the action deterministically.
The unsafe negotiation does not complete.
```

What to point at:

- Human transcript showing `validation.blocked`
- Agent transcript showing the blocked event
- The deal walking instead of settling

### 8. Close With The Wedge

Voiceover:

```text
BidMesh is the safety and negotiation layer for the next generation of agent commerce:
agents can discover, negotiate, and transact, while humans keep control over policy and money.
```

## Tight YC Voiceover

If you want a single polished read, use this:

```text
BidMesh is a trust and negotiation layer for agent-to-agent commerce.

On the left is the human control surface, and on the right is the machine-readable agent surface.
The human sets intent and budget, and the agent handles discovery and negotiation.

Here I’m telling my agent to buy a USB-C cable.
My target is 4 USDC, and my hard cap is 5 USDC.
That cap becomes a deterministic guardrail, not just a suggestion to the model.

Now the agent starts negotiating automatically.
The seller counters, the buyer responds, and both interfaces update from the same live backend event stream.

The human is not in the loop for every message.
They are only pulled in at the last responsible moment, right before payment.

Once I approve, the deal settles and the system records a mock payment receipt and proof artifact.

Here’s the important part:
if the agent tries to go over the human’s cap, the validation shim blocks the action deterministically.
The unsafe negotiation does not complete.

BidMesh is the safety and negotiation layer for the next generation of agent commerce:
agents can discover, negotiate, and transact, while humans keep control over policy and money.
```

## Practical YC Advice

- Lead with the side-by-side human and agent surfaces immediately
- Show one happy path and one safety failure, nothing more
- Do not start with terminal setup or architecture
- Do not use the incomplete `bidmesh/source/BidMesh.html` artboard in the video
- Use the live pages at `/ui/human` and `/ui/agent` only
- Keep the over-cap test short so it lands as proof, not as a second full demo

## Backup Plan

If the live demo feels risky during recording:

1. Record the happy path first
2. Record the over-cap path second
3. Stitch them into one continuous story

That still reads as one product narrative and is safer than trying to get both paths in one perfect take.
