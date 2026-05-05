// BidMesh — Human UI Kit · Atoms
// Lifted from source/human-view.jsx · pixel-perfect cosmetics
const { useState, useMemo } = React;

const H = {
  bg: "#FAFAF8", bg2: "#F4F3EF", bg3: "#F0EFEA", surf: "#FFFFFF", surfSoft: "#FCFBF8",
  fg: "#1B1B18", fg2: "#5C5A52", fg3: "#7A7872", fg4: "#9B998E",
  border: "#E8E6DF", borderStrong: "#E0DED5",
  accent: "#2C4F3D", accentMid: "#3A6B5A", accentSoft: "#5A8268", accentBg: "#EBF1EE", accentBd: "#D5E3DC",
  success: "#2F6B3A", successBg: "#EAF2EA", successBd: "#D5E5D6",
  warn: "#8A6500", warnBg: "#FAF1DC", warnBd: "#F0E2B0", warnTint: "#FFFDF6",
  danger: "#9B2C2C", dangerBg: "#F9EAEA", dangerBd: "#F1D5D5",
  font: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

// ─── Pill ────────────────────────────────────────────────────────────
function HPill({ tone = "neutral", children }) {
  const tones = {
    neutral: { bg: H.bg3, fg: H.fg2, bd: H.borderStrong },
    sage:    { bg: H.accentBg, fg: H.accentMid, bd: H.accentBd },
    green:   { bg: H.successBg, fg: H.success, bd: H.successBd },
    amber:   { bg: H.warnBg, fg: H.warn, bd: H.warnBd },
    red:     { bg: H.dangerBg, fg: H.danger, bd: H.dangerBd },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 8px", borderRadius: 999,
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
      fontSize: 11.5, fontWeight: 500, letterSpacing: "0.005em",
    }}>{children}</span>
  );
}

// ─── Button ──────────────────────────────────────────────────────────
function HButton({ kind = "ghost", size = "md", children, ...rest }) {
  const base = {
    fontFamily: H.font, cursor: "pointer", fontWeight: 500,
    padding: size === "sm" ? "6px 12px" : "8px 14px",
    fontSize: size === "sm" ? 12 : 13,
    borderRadius: size === "sm" ? 6 : 7,
    borderWidth: 1, borderStyle: "solid",
  };
  const tones = {
    primary: { background: H.fg, color: H.bg, borderColor: H.fg },
    ghost:   { background: "#fff", color: H.fg, borderColor: H.borderStrong },
    danger:  { background: "#fff", color: H.danger, borderColor: "#E5BFBF" },
    sage:    { background: H.accent, color: "#fff", borderColor: H.accent },
  };
  return <button style={{ ...base, ...tones[kind] }} {...rest}>{children}</button>;
}

// ─── Pulsing live dot ────────────────────────────────────────────────
function HPulsingDot({ color = H.accentSoft }) {
  return (
    <span style={{ position: "relative", width: 8, height: 8, display: "inline-block" }}>
      <span style={{ position: "absolute", inset: 0, background: color, borderRadius: 999 }} />
      <span style={{
        position: "absolute", inset: -3, border: `2px solid ${color}`, borderRadius: 999,
        opacity: 0.5, animation: "h-pulse 1.6s ease-out infinite",
      }} />
      <style>{`@keyframes h-pulse { 0%{transform:scale(0.6);opacity:0.6} 100%{transform:scale(1.6);opacity:0} }`}</style>
    </span>
  );
}

// ─── Card ────────────────────────────────────────────────────────────
function HCard({ children, padding = 20, style = {} }) {
  return (
    <div style={{
      background: H.surf,
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: H.border,
      borderRadius: 10, padding, ...style,
    }}>{children}</div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────
function HStat({ label, value, sub, tone = "neutral" }) {
  const accent = { neutral: H.fg, sage: H.accentMid, green: H.success, amber: H.warn }[tone];
  return (
    <HCard>
      <div style={{ color: H.fg3, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: accent, marginTop: 4, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ color: H.fg3, fontSize: 12, marginTop: 2 }}>{sub}</div>
    </HCard>
  );
}

// ─── Eyebrow + h1 + muted ────────────────────────────────────────────
function HEyebrow({ children }) {
  return <div style={{ color: H.fg3, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{children}</div>;
}
function HKbd({ children }) {
  return <span style={{
    fontFamily: H.mono, fontSize: 11.5, color: H.fg2,
    background: H.bg3, border: `1px solid ${H.borderStrong}`, padding: "1px 6px", borderRadius: 4,
  }}>{children}</span>;
}

// ─── Deterministic agent glyph (5×3 mirrored) ────────────────────────
function AgentGlyph({ seed = "agent", size = 28 }) {
  const data = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 131 + seed.charCodeAt(i)) >>> 0;
    const cells = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      cells.push((h & 7) > 3);
    }
    return { cells, hue: h % 360 };
  }, [seed]);
  const px = size / 5;
  const fg = `oklch(0.62 0.16 ${data.hue})`;
  const bg = `oklch(0.96 0.02 ${data.hue})`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: size * 0.22 }}>
      <rect width={size} height={size} rx={size * 0.22} fill={bg} />
      {data.cells.map((on, i) => {
        if (!on) return null;
        const r = Math.floor(i / 3), c = i % 3;
        const x1 = c * px + px, x2 = (4 - c) * px + px, y = r * px + px * 0.5;
        return (
          <g key={i} fill={fg}>
            <rect x={x1 - px / 2} y={y - px / 2} width={px} height={px} />
            <rect x={x2 - px / 2} y={y - px / 2} width={px} height={px} />
          </g>
        );
      })}
    </svg>
  );
}

// short pubkey (0x4a3f…c0de)
function shortPubkey(k = "0x4a3f1c2e8b9d6a4c5e7f8d2b1a3c0de") {
  return k.length > 10 ? `${k.slice(0, 6)}…${k.slice(-4)}` : k;
}

Object.assign(window, { H, HPill, HButton, HPulsingDot, HCard, HStat, HEyebrow, HKbd, AgentGlyph, shortPubkey });
