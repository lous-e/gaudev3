// BidMesh — Agent UI Kit · Atoms (terminal/IDE)
const A = {
  bg: "#0A0B0D", bg2: "#08090B", bg3: "#0C0D10",
  border: "#1A1C20", borderBlue: "#1A2940",
  fg: "#C7C9CC", fg2: "#9DA1A8", fg3: "#6B6F75", fg4: "#4D5057", fg5: "#3D4046",
  green: "#7DE39A", blue: "#6EA8FE", amber: "#F1C46B", red: "#FF6B6B",
  font: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
  sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
};

// ─── Pill ────────────────────────────────────────────────────────────
function APill({ tone = "neutral", children }) {
  const tones = {
    neutral: { bg: "rgba(199,201,204,0.08)", fg: A.fg2 },
    green:   { bg: "rgba(125,227,154,0.10)", fg: A.green },
    amber:   { bg: "rgba(241,196,107,0.10)", fg: A.amber },
    red:     { bg: "rgba(255,107,107,0.12)", fg: A.red },
    blue:    { bg: "rgba(110,168,254,0.10)", fg: A.blue },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 6px", borderRadius: 2,
      background: t.bg, color: t.fg,
      fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>{children}</span>
  );
}

// ─── Terminal-style button ───────────────────────────────────────────
function ABtn({ tone = "green", children, ...rest }) {
  const color = { green: A.green, blue: A.blue, amber: A.amber, red: A.red, dim: A.fg2 }[tone];
  return (
    <button style={{
      background: "transparent", color,
      border: `1px solid ${A.border}`, borderRadius: 2,
      padding: "4px 10px", fontFamily: A.font, fontSize: 11,
      cursor: "pointer", letterSpacing: "0.02em",
    }} {...rest}>{children}</button>
  );
}

// ─── Big stat tile ───────────────────────────────────────────────────
function ABigStat({ label, value, sub, accent = A.green }) {
  return (
    <div style={{ border: `1px solid ${A.border}`, padding: 12, background: A.bg3 }}>
      <div style={{ color: A.fg5, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: accent, fontSize: 22, marginTop: 6, letterSpacing: "-0.01em", fontWeight: 500 }}>{value}</div>
      <div style={{ color: A.fg3, fontSize: 10.5, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ─── Spec key=val ────────────────────────────────────────────────────
function ASpec({ label, value, tone = "neutral" }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ color: A.fg5, fontSize: 10 }}>{label}=</span>
      <APill tone={tone}>{value}</APill>
    </div>
  );
}

// ─── Section header (terminal banner) ────────────────────────────────
function ABanner({ children, tone = "green", style = {} }) {
  const accent = { green: A.green, red: A.red, amber: A.amber, blue: A.blue }[tone];
  const bg = tone === "red" ? "rgba(255,107,107,0.05)" : "transparent";
  return (
    <div style={{
      border: `1px solid ${tone === "red" ? A.red : A.border}`,
      borderLeft: `3px solid ${accent}`,
      padding: "10px 14px", background: bg,
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, { A, APill, ABtn, ABigStat, ASpec, ABanner });
