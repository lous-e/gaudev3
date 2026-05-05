# BidMesh — Agent UI Kit

The terminal/IDE surface for "Make Something Agents Want." Near-black canvas, JetBrains Mono, IDE-syntax accents (green/blue/amber/red), 3-column tmux-style layout.

## Files
- `atoms.jsx` — `A` token object + `APill`, `ABtn`, `ABigStat`, `ASpec`, `ABanner`
- `shell.jsx` — `ARail` (left, 180px), `ATopbar` (host:path$ prompt), `AInspector` (right, 320px JSON inspector + schema), `AShell` (3-col wrapper)
- `screens.jsx` — `ASession` (NuffV1 firehose), `ARPCColumn`, `ARPCEvent`, `AShimStrip`, `AMCPDocs` (install/cli/tool/error reference), `AAuditTail`
- `index.html` — interactive: 3 tabs + scenario toggle (`ok` / `shim_block`)

## Usage
```jsx
<AShell tab={tab} setTab={setTab}>
  <ASession blocked={false} />
</AShell>
```

## Design notes
- Hairlines are 1px `#1A1C20`. Cards have **no radius** (well, 2px for syntax pills) — angular and machine-cut.
- Status accent on the left edge: `border-left: 3px solid <green|red|amber|blue>` for banners.
- Every event renders as `arrow method.name [TAG]` then a JSON `<pre>` body — that's the entire visual language.
- Inspector is a fixed-width key=value panel + schema fragment — no fancy components.

## Cuts
- No live RPC; events are static fixtures. Real engine lives in `source/shared-state.jsx` (`useNegotiation`).
- `mcp/api` tab is documentation, not a real OpenAPI explorer.
- Audit tail is read-only.
