// Deterministic 5×3 mirrored identity stamp. Lifted from shared-state.jsx.
// Every BidMesh agent (tessa.agent, cableworks.agent, etc.) gets one.
// The hash drives both cell pattern AND hue.
function AgentGlyph({ seed = "x", size = 28, mono = false }) {
  const cells = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 131 + seed.charCodeAt(i)) >>> 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      cells.push((h & 7) > 3);
    }
  }
  const px = size / 5;
  const hue = (h % 360);
  const fg = mono ? "currentColor" : `oklch(0.62 0.16 ${hue})`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", flexShrink: 0 }}>
      <rect width={size} height={size} rx={size * 0.22} fill={mono ? "transparent" : `oklch(0.96 0.02 ${hue})`} />
      {cells.map((on, i) => {
        if (!on) return null;
        const r = Math.floor(i / 3);
        const c = i % 3;
        const x1 = c * px + px;
        const x2 = (4 - c) * px + px;
        const y = r * px + px * 0.5;
        return (
          <g key={i}>
            <rect x={x1 - px / 2} y={y - px / 2} width={px} height={px} fill={fg} />
            <rect x={x2 - px / 2} y={y - px / 2} width={px} height={px} fill={fg} />
          </g>
        );
      })}
    </svg>
  );
}
window.AgentGlyph = AgentGlyph;
