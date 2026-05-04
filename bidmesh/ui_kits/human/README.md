# BidMesh — Human UI Kit

The buyer/seller dashboard. Notion/Linear/Stripe-flavoured. Warm paper neutrals, soft sage accents, no shadows on the canonical card (1px hairline border instead).

## Files
- `atoms.jsx` — `H` token object + `HPill`, `HButton`, `HPulsingDot`, `HCard`, `HStat`, `HEyebrow`, `HKbd`, `AgentGlyph`, `shortPubkey`
- `shell.jsx` — `HSidebar` (logo + nav + spend-cap meter), `HTopbar` (crumb, search, +new intent), `HShell` (wrapper)
- `screens.jsx` — `HDealsHome`, `HLiveDealCard`, `HPriceLadder`, `HActivityRow`, `HRecentDealsTable`, `HDealDetail`, `HPoliciesScreen`, `HAuditScreen`, `HNewIntentModal`
- `index.html` — interactive click-thru: 4 tabs, deals → deal detail, confirm-and-pay flow, +new intent modal

## Usage
```jsx
<HShell tab={tab} setTab={setTab} crumb="Workspace · Deals">
  <HDealsHome onOpenDeal={() => setTab("deal")} />
</HShell>
```

All components consume the `H` token object — no styled-components or CSS-in-JS framework. Just inline style objects.

## Design notes
- 232px sidebar (sage-on-paper), 52px topbar with crumb on the left and `+ New intent` primary on the right
- Card = `#FFFFFF` + 1px `#E8E6DF` border + 10px radius — no shadow
- Status stripe lives at card-bottom (bg `#FCFBF8`) for live deals
- Confirm-payment surface uses `--h-warn-tint` (`#FFFDF6`) — nearly-white wheat, not yellow
- No emoji. Functional glyphs only: ◇ ● ◈ ◉ ▤ ◐ ⌕ ✓ ⊘ ↩ ↻ ▶ ❚❚

## Cuts
- No real authentication
- Agent glyphs are deterministic from handle string but visuals are decorative
- All prices/transcripts are hardcoded fixtures, not driven by `useNegotiation` engine (see `source/shared-state.jsx`)
