---
name: bidmesh-design
description: Use this skill to generate well-branded interfaces and assets for BidMesh, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the dual human (Notion/Linear-style) and agent (terminal/IDE) surfaces of an agent-to-agent commerce product.
user-invocable: true
---

# BidMesh design skill

Read the `README.md` file within this skill, and explore the other available files. Quick map:

- `README.md` — full system: positioning, content fundamentals, visual foundations, iconography, file index
- `colors_and_type.css` — all CSS vars (human + agent palettes, type scale, semantic vars)
- `assets/` — `logo-human.svg`, `logo-agent.svg`, `agent-glyph.jsx` (deterministic 5×3 mirrored stamp)
- `ui_kits/human/` — Notion/Linear/Stripe-flavoured buyer dashboard (atoms / shell / screens / index.html)
- `ui_kits/agent/` — terminal/IDE-flavoured machine console (atoms / shell / screens / index.html)
- `preview/` — small specimen cards (color, type, components) you can lift inline
- `source/` — original Guadev3 codebase the system was reverse-engineered from. Source of truth for any token or component.

## Core rule

BidMesh is **always two surfaces**. If a design only shows one of them, you've probably forgotten the duality. Pick the right one for the audience:

| Audience | Surface | Vibe |
|---|---|---|
| The human buyer/seller | `ui_kits/human/` | Warm paper · sage accent · Inter · 1px hairlines · 10px radius · no shadow |
| Other agents / developers | `ui_kits/agent/` | Near-black · JetBrains Mono · IDE-syntax accents · angular, no radius |

## How to use

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out of this skill folder and create static HTML files for the user to view. Use the JSX components from `ui_kits/<human|agent>/` directly — they're inline-style React with no build step.

If working on production code, read the rules here to become an expert in designing with this brand. The visual foundations and content fundamentals sections of `README.md` are the authoritative reference.

If the user invokes this skill without any other guidance, ask them what they want to build or design (which surface? human, agent, or the dual split-screen?), ask some questions about scope, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Don't

- Don't use emoji. The system uses geometric glyphs only (◇ ● ◈ ◉ ▤ ◐ ⌕ ✓ ⊘ ↩ ↻ ▶ ❚❚).
- Don't add gradients to backgrounds. Gradients exist only inside the human logo mark.
- Don't soften the agent surface. It's deliberately stark — no rounded cards, no soft shadows, no warm tints.
- Don't invent new colors. Use the tokens in `colors_and_type.css`.
- Don't substitute the fonts: **Inter** (human) + **JetBrains Mono** (agent and all numerals).
