# BidMesh Design System

> Agent-to-agent commerce. Humans set spend caps. Agents negotiate. Validation
> shims enforce. **An agent may choose tactics, but it may not alter authority.**

BidMesh is a YC-pitch product (originally `Guadev3`) for a **NuffV1**-protocol
marketplace where two human-aligned agents negotiate purchases under
deterministic, human-set policy. The whole product fans out across **two
co-equal surfaces**:

| Surface | Audience | Vibe |
|---|---|---|
| **Human view** | The buyer/seller (Tessa) reviewing what their agent just did | Notion / Linear / Stripe — warm neutrals, generous whitespace, soft sage accents |
| **Agent view** | Other agents and developers wiring BidMesh in | Terminal / tmux / IDE — JSON-RPC firehose, machine-readable everywhere |

The pitch hinges on **the negotiation theater** — a split-screen showing the
same deal narrated for a human on the left and structured for an agent on the
right. That duality drives every component decision in the system.

---

## Sources

This system was reverse-engineered from a single design exploration in the
`Guadev3` codebase (now copied into `source/`):

- `source/BidMesh.html` — root design canvas wiring all artboards together
- `source/shared-state.jsx` — negotiation engine, transcript builder, agent glyph
- `source/human-view.jsx` — `HumanShell` (sidebar + topbar + 4 tabs)
- `source/agent-view.jsx` — `AgentShell` (rail + topbar + 3 tabs + inspector)
- `source/negotiation-theater.jsx` — the YC hero split-screen with price tape
- `source/marketplace-seller.jsx` — `MarketplaceView`, `SellerConsole`
- `source/agent-marketplace.jsx` — terminal-native clawstr discovery
- `source/vision.md` — full **NuffV1** protocol spec (types, envelopes, methods)
- `source/plan.md` — 3–4-hour ClawHub MVP build plan (the YC pitch)

There is no Figma file or external design system. All tokens, components, and
content patterns in this design system were extracted from the source above.

---

## Index

```
.
├── README.md                       ← you are here
├── SKILL.md                        ← Claude Skill descriptor (cross-compatible)
├── colors_and_type.css             ← all color + type tokens
├── source/                         ← original Guadev3 exploration
├── fonts/                          ← (CDN — see Type substitution note)
├── assets/                         ← logos, glyphs
├── preview/                        ← design-system review cards
└── ui_kits/
    ├── human/                      ← Notion-soft buyer surface
    │   ├── README.md
    │   ├── index.html              ← interactive deals → policies → audit click-thru
    │   └── *.jsx                   ← Sidebar, Topbar, Card, Pill, Button, …
    └── agent/                      ← terminal-native agent surface
        ├── README.md
        ├── index.html              ← interactive RPC firehose + clawstr search
        └── *.jsx                   ← Rail, RPCEvent, BigStat, ShimStrip, …
```

No slide deck was provided in the source materials, so this system ships **no
sample slides**. If you want them, ask and we'll build them against these
tokens.

---

## Content fundamentals

BidMesh has **two voices** that ride on the same product. Pick by surface.

### Human voice — calm, declarative, slightly literary

- **You-first**, second person. "Your agent has 1 active negotiation."
- **Lowercase verbs in tags / pills** ("settled", "walked", "blocked"). Prose
  uses sentence case.
- **Numerals are first-class**. Prices always render in mono (`4.75 USDC`).
- **One-line factual reassurance** in muted text: *"never your money"*,
  *"all under cap"*, *"you sign off in Telegram or here."*
- **No emoji**. Status uses geometric glyphs from a small inventory: `◇ ● ◈ ◉ ▤ ◐ ⌕ ✓ ↩ ⊘ ↻ ❚❚ ▶ ↑ ↓ ↔ ⌘K`.
- **Time of day acknowledged**: *"Wednesday, May 4 — Good afternoon, Tessa."*

Examples (verbatim from `human-view.jsx`):

> *"Your agent operates inside these limits. Validation shims enforce them
> deterministically — no LLM can override them."*

> *"Append-only. Every offer, counter, accept, walk, block, and settle.
> Receipts for the trillion-agent economy."*

### Agent voice — terse, structured, machine-readable

- **Lowercase, mono throughout.** Even nav items: `negotiate`, `mcp/api`, `audit.log`.
- **`$` prompt** opens commands: `$ bidmesh negotiate --intent ./intent.json`.
- **Comments use `//`**, not `#`.
- **Status is two-state, present tense**: `connected`, `enforced`, `live`,
  `denied`, `allow`. Never sentences.
- **Code beats prose**. Whenever a thing can be a JSON literal, it is one.
- **Agents are first-class subjects**: they "discover", "settle", "deny" — never
  "users" or "people".

Examples:

> *"Make Something Agents Want."*
> *"Agent-first commerce. machine-readable. validated locally before every send."*
> *"Discovered without a human. No login. No CAPTCHAs. No HTML-scraping."*

### Shared rules

- **Currency** is `USDC` by default; `USD` is a tweakable display fallback.
- **Pubkeys** are always shortened: `0x4a3f…c0de` (6+4, ellipsis is `…`).
- **Round notation**: `r1`, `r2`, `r3` — never "round one".
- **Reason codes are `snake_case`**: `accepted_price_exceeds_max_price`,
  `round_limit`, `validation_denied`, `price_too_high`, `price_too_low`.
- **Settlement language**: *"paid X USDC on base-sepolia"* + tx hash. Never
  "purchase complete".

---

## Visual foundations

### Two-palette system

There is no single palette — there are **two**. Every component declares which
side it lives on. The full set is in `colors_and_type.css`.

- **Human side** (`--h-*`): warm paper neutrals (`#FAFAF8` page, `#F4F3EF`
  sidebar, `#FFFFFF` card), one accent (sage `#2C4F3D` → `#5A8268`), and four
  semantic pills (sage / green / amber / red — all softened, `OKLCH`-ish in
  feel: `#EBF1EE`, `#EAF2EA`, `#FAF1DC`, `#F9EAEA`).
- **Agent side** (`--a-*`): near-black canvas (`#0A0B0D`), four IDE-syntax
  accents (green `#7DE39A`, blue `#6EA8FE`, amber `#F1C46B`, red `#FF6B6B`),
  hairline borders at `#1A1C20`. Greens mean "success / prompt", blues mean
  "outbound / method", amber means "counterparty / list", red means "blocked".

The two surfaces meet **only** in the negotiation theater, where the dark agent
canvas frames a light human panel. The split is hard-edged (`1px` border, no
gradient bridge).

### Typography

- **Inter** for everything humanist; **JetBrains Mono** for prices, pubkeys,
  rpc methods, audit logs, anything numeric you'd want to copy-paste.
- Display sizes always carry **negative tracking** (`-0.02em` on H1, `-0.01em`
  on H2). Eyebrows uppercase + `0.06em` letter-spacing.
- **Big numbers are mono.** The 44px live price, the 32px current offer, the
  audit-log columns, every cap and floor pill. Mono = "this is data".
- Body text leans tight (`line-height: 1.5`); only the audit log goes looser
  (`1.7`) to feel like a console.

### Backgrounds, surfaces & layering

- **No imagery.** No photos, no illustrations, no patterns, no gradients on
  large surfaces. The product is a console; backgrounds stay still.
- **One** intentional gradient: the BidMesh logo mark
  (`linear-gradient(135deg, #2C4F3D, #5A8268)` on human side; `→ #7DE39A` on
  agent side). That's it.
- Layering is achieved with **value differences in warm neutrals** (`#FAFAF8`
  → `#F4F3EF` → `#F0EFEA` → `#FCFBF8`) or **value differences in near-black**
  (`#0A0B0D` → `#08090B` → `#0C0D10`). Borders, never shadows, do separation.

### Borders, radii, cards

- **Human cards**: `1px solid #E8E6DF`, `border-radius: 10px`, `padding: 20px`,
  on `#FFFFFF`. No shadow. No drop. The hairline is the card.
- **Agent panels**: `1px solid #1A1C20`, `border-radius: 0` *or* `2-3px`. A
  3px **left accent** (green / red / blue) on banner-style strips
  (`ShimStrip`, the `$ bidmesh negotiate` banner, the `discovered without a
  human` callout).
- **Pills/chips**: `border-radius: 999px` on human side, `border-radius: 2px`
  on agent side. Same data, different geometry.
- **Buttons**: human primary `#1B1B18` on `#FAFAF8`, ghost `#FFF` with
  `#E0DED5` border, danger ink `#9B2C2C` on white. Agent buttons are
  transparent with green text and a `#1A1C20` hairline; the *primary* CTA on
  the agent side flips to **`#7DE39A` background, `#0A0B0D` text** (only used
  on the discovery page's "negotiate.open" button).

### Shadows & glows

Practically zero shadow on the human side — it's a paper system. The only
shadow-like effects are **glows on the agent side**:

- `box-shadow: 0 0 18px #7DE39A` on the active price marker
- `box-shadow: 0 0 8px <color>66` on cap/floor boundary lines
- `0 0 16px rgba(255,107,107,0.35)` on the shim-block "⊘" tile
- `text-shadow: 0 1px 4px rgba(0,0,0,0.7)` on price labels over the dark tape

Glows are **small, single-source, color-matched** to the element. Never
ambient, never atmospheric.

### Motion

Motion is **deliberate and narrative**, not decorative. Used in three places:

1. **Transcript playback**: events appear at `1100ms / pace` step delay, with
   a `400ms` first-event lead. The whole negotiation reads like a tape.
2. **Pulsing dots**: the green "live" pulse on the human side
   (`scale 0.6 → 1.6, opacity 0.6 → 0`, `1.6s ease-out infinite`); the active
   price marker on the tape (`scale 0.9 → 1.8`, `1.4s`).
3. **Price-marker slide**: the current-offer dot tweens its `left` over
   `500ms cubic-bezier(.4, 0, .2, 1)` whenever a new round comes in.

There are **no fades, no bounces, no scale-on-press**. Hover state is a single
background shift; press state is just `cursor: pointer` (no transform).

### Hover, press, focus

- **Human nav item**: hovered/selected = `background: #E8E6DF`, font-weight 500.
- **Human button**: no transform; the press is implied by the click target.
- **Agent nav item**: selected = `border-left: 2px solid #7DE39A`, text turns
  `#7DE39A`, background tints to `rgba(125,227,154,0.06)`.
- **Listing rows** (agent marketplace): selected row turns
  `rgba(125,227,154,0.06)` and gains a 2px green left border. Same pattern.
- **No focus rings declared yet** — flag for accessibility pass.

### Layout rules

- **Human shell**: `grid-template-columns: 232px 1fr` (sidebar + main).
  Topbar `52px`. Body padding `32px 40px 80px`. Max content width `1080px`.
- **Agent shell**: `grid-template-columns: 180px 1fr 320px` (rail + main +
  inspector). Topbar `36px`. Body padding `14px`.
- **Cards** sit in 12-grids on the deals home (`repeat(4, 1fr)` for stat
  tiles, `2.4fr 1.4fr 1fr 1fr 0.9fr 0.9fr` for the recent-deals table).
- **Marketplace listings** are a 2-up grid (`repeat(2, 1fr)`).
- The negotiation theater is **rigidly 1:1 split** at the center, with a
  shared price tape footer that spans both halves.

### Transparency & blur

Used only on the agent side. Tints are always `rgba(<accent>, 0.04 – 0.12)`
over a dark background — never over a photographic backdrop. **No backdrop
blur anywhere.** The product is opaque.

### Imagery vibe

There is no imagery. If we ever add it, the rule is: **black-and-white, grain
acceptable, never warm color**. The human surface is warm; imagery must
contrast it.

### What to avoid

- Bluish-purple gradients (we don't ship these — they belong to a different
  product category)
- Soft drop shadows on cards
- Emoji (use the geometric-glyph inventory)
- Rounded-corner-with-left-color-accent cards on the **human** side. Left
  accents are an agent-side device only.
- Decorative icons. Every glyph is functional.

---

## Iconography

BidMesh ships **no icon font, no SVG sprite, and no `<img>` icons** in the
source. Iconography is achieved entirely through **a small inventory of
typographic glyphs** rendered in the same fonts as the rest of the UI:

| Glyph | Meaning | Where |
|---|---|---|
| `◇` | Deals (idle) | human sidebar |
| `●` | Live deal (with badge) | human sidebar; "live" pulsing dot |
| `◈` | Spending policies | human sidebar |
| `◉` | Audit log | human sidebar |
| `▤` | Marketplace | human sidebar |
| `◐` | Trusted agents | human sidebar |
| `⌕` | Search | topbar |
| `⌘K` | Search shortcut | kbd |
| `✓` | Settled | status pill |
| `↩` | Walked | status pill |
| `⊘` | Blocked / shim-denied | audit, theater |
| `↻` | Replay | playback control |
| `❚❚ / ▶` | Pause / play | playback control |
| `↑ / ↓` | Track direction (buyer/seller) | price tape |
| `↔` | Negotiating with | theater header |
| `→ / ←` | Outbound / inbound rpc | agent log |
| `▸` | Selected item, CLI option | agent rail |
| `▍` | Cursor | agent stream |
| `★` | Rating | marketplace chip |
| `·` | Soft separator | meta lines |

**Logo mark**: a single rounded square with a monospace `B` glyph. Two
variants:

- Human: `linear-gradient(135deg, #2C4F3D, #5A8268)` background, `#FAFAF8` `B`.
  Sized 22–26px in topbars, 26–28px on the sidebar.
- Agent: solid `#7DE39A` background, `#0A0B0D` `B`, sized 16px. Used as a
  prompt-glyph in the agent rail.

**`AgentGlyph` component** — every agent identity (`tessa.agent`,
`cableworks.agent`, `creditpool`) gets a **deterministic 5×3 mirrored stamp**
generated from its handle. The hash drives both cell pattern *and* hue
(`oklch(0.62 0.16 <hue>)`). On the agent side, pass `mono` to render as
currentColor. This is the project's only generative visual; treat it as a
core asset, not a placeholder.

**Substitution flag**: BidMesh has no production icon set yet. If we later
need additional icons (lightning, lock, network, wallet), the closest CDN
match is **[Lucide](https://lucide.dev/)** at stroke-width `1.5`, but it has
not been adopted in the source codebase. Flag and confirm before adding.

**Emoji**: never. **Unicode geometric chars**: yes, from the inventory above.
**SVG**: only for the `AgentGlyph` and the `PathConnector` polylines on the
price tape.

Logos and the agent glyph are reproduced as standalone components and SVGs
under `assets/`.

---

## File index (manifest)

```
README.md                  · this file — positioning, content, visual, iconography
SKILL.md                   · Agent Skills frontmatter wrapper, drop-in for Claude Code
colors_and_type.css        · all CSS vars (human + agent palettes, type scale, semantic)
assets/
  logo-human.svg           · 64×64 sage-gradient B mark
  logo-agent.svg           · 64×64 terminal $ prompt mark
  agent-glyph.jsx          · deterministic 5×3 mirrored identity stamp
ui_kits/
  human/                   · Notion/Linear-flavoured buyer dashboard
    README.md  atoms.jsx  shell.jsx  screens.jsx  index.html
  agent/                   · Terminal/IDE-flavoured machine console
    README.md  atoms.jsx  shell.jsx  screens.jsx  index.html
preview/                   · 14 specimen cards (color, type, components, brand) shown
                             in the Design System tab. Each is a tiny standalone HTML.
source/                    · the original Guadev3 codebase + plan + vision (read-only
                             reference; this system was reverse-engineered from here)
```

Open `ui_kits/human/index.html` or `ui_kits/agent/index.html` to see the kits running. Both are click-through prototypes — tabs, modals, scenario toggles all work; data is fixed fixtures.

---

## How to use this system

1. Read `colors_and_type.css` and pull tokens via CSS custom properties.
2. Pick a side: `--h-*` for human surfaces, `--a-*` for agent surfaces.
   Mixing within one component is allowed only inside the negotiation theater.
3. For UI compositions, copy from `ui_kits/human/` or `ui_kits/agent/` —
   each kit's `index.html` is a click-through interactive recreation of a
   real BidMesh screen.
4. For tone, lift directly from the **content fundamentals** examples above.
5. Never invent new accent colors. Pull from the eight semantic tokens.
