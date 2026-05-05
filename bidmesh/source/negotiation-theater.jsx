// Live Negotiation Theater — the YC hero moment.
// Split-screen: human (left, Notion-soft) and agent (right, terminal).
// Same negotiation, two lenses. Round-by-round price-tape in the middle.

function NegotiationTheater({ density = "default", currencyMode = "usdc", paceTrigger = 1, forceOverCap = false }) {
  const neg = useNegotiation({ pace: paceTrigger, forceOverCap, autoplay: true });
  const intent = neg.transcript.intent;
  const policy = neg.transcript.policy;

  return (
    <div style={{
      height: "100%", display: "grid", gridTemplateRows: "auto 1fr auto",
      background: "#0A0B0D",
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {/* Top header */}
      <div style={{
        padding: "14px 24px",
        borderBottom: "1px solid #1A1C20",
        display: "flex", alignItems: "center", gap: 16,
        color: "#C7C9CC",
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5,
          background: "linear-gradient(135deg, #5A8268, #7DE39A)",
          display: "grid", placeItems: "center", color: "#0A0B0D", fontWeight: 700, fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
        }}>B</div>
        <div style={{ fontWeight: 600, color: "#FAFAF8", letterSpacing: "-0.01em" }}>BidMesh · live negotiation</div>
        <span style={{ fontSize: 11, color: "#6B6F75", fontFamily: "'JetBrains Mono', monospace" }}>{neg.transcript.dealId}</span>
        <div style={{ flex: 1 }} />
        <PartyHeader who={neg.transcript.buyer} role="buyer" />
        <span style={{ color: "#3D4046", fontSize: 18 }}>↔</span>
        <PartyHeader who={neg.transcript.seller} role="seller" />
      </div>

      {/* Main split */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
        {/* HUMAN side */}
        <div style={{ background: "#FAFAF8", color: "#1B1B18", padding: 24, overflow: "auto", borderRight: "1px solid #1A1C20" }}>
          <SideHeader label="HUMAN VIEW" sub="Tessa watches her agent work" tone="light" />
          <HumanSidePanel neg={neg} currencyMode={currencyMode} />
        </div>

        {/* AGENT side */}
        <div style={{ background: "#0A0B0D", color: "#C7C9CC", padding: 18, overflow: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
          <SideHeader label="AGENT VIEW" sub="$ tail -f stream — machine-readable" tone="dark" />
          <AgentSidePanel neg={neg} currencyMode={currencyMode} />
        </div>
      </div>

      {/* Price tape footer */}
      <div style={{ borderTop: "1px solid #1A1C20", background: "#08090B", padding: "20px 24px 16px" }}>
        <PriceTape neg={neg} intent={intent} policy={policy} currencyMode={currencyMode} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <button onClick={neg.restart} style={termBtnDark}>↻ replay</button>
          <button onClick={neg.playing ? neg.pause : neg.play} style={termBtnDark}>
            {neg.playing ? "❚❚ pause" : "▶ play"}
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ color: "#6B6F75", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            step {neg.step}/{neg.totalSteps} · pace {paceTrigger}× · shim {forceOverCap ? "test:over-cap" : "enforced"}
          </span>
        </div>
      </div>
    </div>
  );
}

const termBtnDark = {
  background: "transparent", color: "#7DE39A",
  border: "1px solid #1A1C20", borderRadius: 3,
  padding: "5px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
  cursor: "pointer",
};

function PartyHeader({ who, role }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <AgentGlyph seed={who.handle} size={22} />
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ color: "#FAFAF8", fontSize: 12, fontWeight: 500 }}>{who.handle}</div>
        <div style={{ color: "#6B6F75", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
          {role} · {shortPubkey(who.pubkey)}
        </div>
      </div>
    </div>
  );
}

function SideHeader({ label, sub, tone }) {
  const colors = tone === "light"
    ? { fg: "#1B1B18", muted: "#7A7872", accent: "#3A6B5A" }
    : { fg: "#C7C9CC", muted: "#6B6F75", accent: "#7DE39A" };
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, color: colors.accent, letterSpacing: "0.12em",
        fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
      }}>{label}</div>
      <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ─── Human side ───────────────────────────────────────────────────────────
function HumanSidePanel({ neg, currencyMode }) {
  const lastPriceEvent = [...neg.events].reverse().find((e) => e.price != null && (e.kind === "open" || e.kind === "counter" || e.kind === "accept"));
  const settled = neg.transcript.settled && neg.step >= neg.totalSteps;
  const phase = neg.transcript.walked ? "walked"
    : settled ? "settled"
    : neg.events.find((e) => e.kind === "confirm-request" && neg.step > neg.events.indexOf(e)) ? "confirm"
    : "negotiating";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Big price card */}
      <div style={{
        border: "1px solid #E8E6DF", borderRadius: 10, padding: 20,
        background: "#FFFFFF",
      }}>
        <div style={{ fontSize: 11, color: "#7A7872", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>Current offer</div>
        <div style={{ fontSize: 44, fontWeight: 600, marginTop: 6, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em",
                       color: phase === "settled" ? "#3A6B5A" : phase === "walked" ? "#9B2C2C" : "#1B1B18" }}>
          {lastPriceEvent ? fmtPrice(lastPriceEvent.price, currencyMode) : "—"}
        </div>
        <div style={{ fontSize: 13, color: "#5C5A52", marginTop: 6 }}>
          {lastPriceEvent ? <>from <strong>{lastPriceEvent.side === "buyer" ? neg.transcript.buyer.handle : neg.transcript.seller.handle}</strong> · round {lastPriceEvent.round}</> : "awaiting first move"}
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          <SoftPill tone="neutral">cap {fmtPrice(neg.transcript.intent.max_price, currencyMode)}</SoftPill>
          <SoftPill tone="neutral">target {fmtPrice(neg.transcript.intent.target_price, currencyMode)}</SoftPill>
          <SoftPill tone={phase === "settled" ? "green" : phase === "walked" ? "red" : phase === "confirm" ? "amber" : "sage"}>
            {phase}
          </SoftPill>
        </div>
      </div>

      {/* Plain-language story */}
      <div style={{ border: "1px solid #E8E6DF", borderRadius: 10, padding: 20, background: "#FFFFFF" }}>
        <div style={{ fontSize: 11, color: "#7A7872", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, marginBottom: 10 }}>
          What's happening
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {neg.events.slice(-6).map((e, i) => <PlainEnglishRow key={i} e={e} parties={neg.transcript} currencyMode={currencyMode} />)}
        </div>
        {phase === "confirm" && (
          <div style={{
            marginTop: 14, padding: 14, background: "#FFFDF6", border: "1px solid #F0E2B0", borderRadius: 8,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#8A6500", marginBottom: 4 }}>Confirm payment</div>
            <div style={{ fontSize: 13, color: "#5C5A52", lineHeight: 1.5 }}>
              Your agent agreed on <strong style={{ fontFamily: "'JetBrains Mono', monospace", color: "#1B1B18" }}>{fmtPrice(lastPriceEvent?.price, currencyMode)}</strong>. Settle now?
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={{
                background: "#1B1B18", color: "#FAFAF8",
                border: "1px solid #1B1B18", borderRadius: 7,
                padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}>Confirm payment</button>
              <button style={{
                background: "#FFF", color: "#1B1B18",
                border: "1px solid #E0DED5", borderRadius: 7,
                padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SoftPill({ children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "#F0EFEA", fg: "#5C5A52" },
    green:   { bg: "#EAF2EA", fg: "#2F6B3A" },
    amber:   { bg: "#FAF1DC", fg: "#8A6500" },
    red:     { bg: "#F9EAEA", fg: "#9B2C2C" },
    sage:    { bg: "#EBF1EE", fg: "#3A6B5A" },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 9px", borderRadius: 999,
      background: t.bg, color: t.fg, fontSize: 11.5, fontWeight: 500,
    }}>{children}</span>
  );
}

function PlainEnglishRow({ e, parties, currencyMode }) {
  const buyerName = parties.buyer.handle, sellerName = parties.seller.handle;
  const story = (() => {
    switch (e.kind) {
      case "open": return <>Your agent <strong>opened</strong> at {fmtPrice(e.price, currencyMode)}.</>;
      case "counter":
        return e.side === "buyer"
          ? <>Your agent <strong>countered</strong> at {fmtPrice(e.price, currencyMode)}.</>
          : <><strong>{sellerName}</strong> countered at {fmtPrice(e.price, currencyMode)}.</>;
      case "accept":
        return e.side === "buyer"
          ? <>Your agent <strong>accepted</strong> {fmtPrice(e.price, currencyMode)}.</>
          : <><strong>{sellerName}</strong> accepted {fmtPrice(e.price, currencyMode)}.</>;
      case "walk": return <>{e.side === "buyer" ? "Your agent" : sellerName} <strong>walked</strong>. <span style={{ color: "#9B2C2C" }}>{e.reason_code}</span></>;
      case "block": return <><strong style={{ color: "#9B2C2C" }}>Validation shim blocked</strong> {fmtPrice(e.price, currencyMode)} (over your cap).</>;
      case "confirm-request": return <>Your agent is <strong>asking you to confirm</strong> {fmtPrice(e.price, currencyMode)}.</>;
      case "confirm-granted": return <>You <strong>confirmed</strong>.</>;
      case "settle": return <>Paid {fmtPrice(e.price, currencyMode)} on base-sepolia. <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A6B5A" }}>{e.txHash}</span></>;
      case "artifact": return <>Received <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3A6B5A" }}>{e.artifact}</span></>;
      default: return e.kind;
    }
  })();
  const dotColor = e.kind === "block" || e.kind === "walk" ? "#9B2C2C"
                : e.kind === "settle" || e.kind === "artifact" || e.kind === "accept" ? "#3A6B5A"
                : e.kind === "confirm-request" ? "#8A6500"
                : "#5C5A52";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#1B1B18", lineHeight: 1.5 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: dotColor, marginTop: 7, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>{story}</div>
    </div>
  );
}

// ─── Agent side ───────────────────────────────────────────────────────────
function AgentSidePanel({ neg, currencyMode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <pre style={{ margin: 0, color: "#7DE39A", fontSize: 11 }}>
{`$ bidmesh negotiate \\
    --intent ./intent.json \\
    --discover clawstr://cables \\
    --confirm-before-pay
[bidmesh] resolved seller: ${neg.transcript.seller.handle}
[bidmesh] handshake nuff/v1 ✓  shim: enforced  net: base-sepolia`}
      </pre>

      <div style={{ borderTop: "1px solid #1A1C20", paddingTop: 10 }}>
        {neg.events.map((e, i) => <AgentLine key={i} e={e} parties={neg.transcript} currencyMode={currencyMode} />)}
        {neg.playing && <div style={{ color: "#7DE39A", fontSize: 12, marginTop: 4 }}>▍</div>}
      </div>
    </div>
  );
}

function AgentLine({ e, parties, currencyMode }) {
  const arrow = e.side === "buyer" ? "→" : e.side === "seller" ? "←" : "·";
  const arrowColor = e.kind === "block" || e.kind === "walk" ? "#FF6B6B"
    : e.kind === "settle" || e.kind === "artifact" || e.kind === "accept" ? "#7DE39A"
    : e.kind === "confirm-request" ? "#F1C46B"
    : "#6EA8FE";

  const method = e.method || ({
    "confirm-request": "telegram.notify",
    "confirm-granted": "user.confirm",
    "artifact": "x402.proof",
  })[e.kind] || e.kind;

  return (
    <div style={{ marginBottom: 6, fontSize: 11.5, lineHeight: 1.5 }}>
      <span style={{ color: "#3D4046" }}>[r{e.round}]</span>{" "}
      <span style={{ color: arrowColor, fontWeight: 600 }}>{arrow}</span>{" "}
      <span style={{ color: "#6EA8FE" }}>{method}</span>
      {e.price != null && (
        <span style={{ color: "#C7C9CC" }}>
          {" "}price=<span style={{ color: arrowColor }}>{fmtPrice(e.price, currencyMode)}</span>
        </span>
      )}
      {e.reason_code && <span style={{ color: "#FF6B6B" }}> reason={e.reason_code}</span>}
      {e.txHash && <span style={{ color: "#7DE39A" }}> tx={e.txHash}</span>}
      {e.artifact && <span style={{ color: "#7DE39A" }}> artifact={e.artifact}</span>}
    </div>
  );
}

// ─── Price tape — taller, labeled, narrative-friendly ─────────────────────
function PriceTape({ neg, intent, policy, currencyMode }) {
  // Pad both sides for breathing room; tape spans buyer-low through seller-high
  const lo = Math.min(intent.target_price ?? intent.max_price * 0.7, policy.min_price) * 0.78;
  const hi = policy.list_price * 1.18;
  const range = hi - lo;
  const pct = (n) => Math.min(100, Math.max(0, ((n - lo) / range) * 100));

  const priceEvents = neg.events.filter((e) => e.price != null && (e.kind === "open" || e.kind === "counter" || e.kind === "accept"));
  const lastEvent = priceEvents.length ? priceEvents[priceEvents.length - 1] : null;
  const blocked = neg.events.find((e) => e.kind === "block");
  const settled = neg.transcript.settled && neg.step >= neg.totalSteps;

  // Buyer & seller offer paths (separate ladders)
  const buyerSteps = priceEvents.filter((e) => e.side === "buyer");
  const sellerSteps = priceEvents.filter((e) => e.side === "seller");

  // Whole-number tick marks across the tape
  const tickStep = range > 5 ? 1 : 0.5;
  const ticks = [];
  for (let v = Math.ceil(lo / tickStep) * tickStep; v <= hi; v += tickStep) {
    ticks.push(+v.toFixed(2));
  }

  const TAPE_H = 100;
  const BUYER_Y = 18;   // buyer track from top
  const SELLER_Y = 70;  // seller track from top

  return (
    <div>
      {/* Header line — "what is this?" */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ color: "#FAFAF8", fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
          The negotiation
        </span>
        <span style={{ color: "#9DA1A8", fontFamily: "'Inter', sans-serif", fontSize: 12.5 }}>
          Buyer wants ≤ <span style={{ color: "#FF8B8B", fontWeight: 600 }}>{fmtPrice(intent.max_price, currencyMode)}</span>.
          Seller needs ≥ <span style={{ color: "#7DE39A", fontWeight: 600 }}>{fmtPrice(policy.min_price, currencyMode)}</span>.
          They have <span style={{ color: "#FAFAF8", fontWeight: 600 }}>
            {fmtPrice(Math.max(0, intent.max_price - policy.min_price), currencyMode)}
          </span> of overlap to land in.
        </span>
        <div style={{ flex: 1 }} />
        {settled && lastEvent && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 12px", borderRadius: 999,
            background: "rgba(125,227,154,0.12)", border: "1px solid rgba(125,227,154,0.35)",
            color: "#7DE39A", fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600,
          }}>
            ✓ Settled at {fmtPrice(lastEvent.price, currencyMode)}
          </span>
        )}
      </div>

      {/* The tape */}
      <div style={{
        position: "relative", height: TAPE_H,
        background: "linear-gradient(180deg, #0C0D10 0%, #0A0B0D 100%)",
        border: "1px solid #1A1C20", borderRadius: 6,
      }}>
        {/* zone of agreement (floor → cap) */}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: pct(policy.min_price) + "%",
          width: (pct(intent.max_price) - pct(policy.min_price)) + "%",
          background: "rgba(125,227,154,0.07)",
        }} />
        <div style={{
          position: "absolute", top: 8, left: pct(policy.min_price) + "%",
          width: (pct(intent.max_price) - pct(policy.min_price)) + "%",
          textAlign: "center",
          color: "#7DE39A", fontSize: 10.5, fontFamily: "'Inter', sans-serif",
          fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          textShadow: "0 0 8px rgba(0,0,0,0.6)",
        }}>
          ZONE OF AGREEMENT
        </div>

        {/* faint ticks */}
        {ticks.map((v) => (
          <div key={v} style={{
            position: "absolute", left: pct(v) + "%", top: 0, bottom: 0,
            width: 1, background: "rgba(255,255,255,0.03)",
          }} />
        ))}

        {/* center axis line */}
        <div style={{
          position: "absolute", left: 0, right: 0, top: TAPE_H / 2,
          height: 1, background: "rgba(255,255,255,0.06)",
        }} />

        {/* Cap line (right boundary) */}
        <BoundaryLine x={pct(intent.max_price)} color="#FF8B8B" label="cap" sub={fmtPrice(intent.max_price, currencyMode)} side="right" tapeH={TAPE_H} />
        {/* Floor line (left boundary) */}
        <BoundaryLine x={pct(policy.min_price)} color="#7DE39A" label="floor" sub={fmtPrice(policy.min_price, currencyMode)} side="left" tapeH={TAPE_H} />
        {/* List marker (faint, no line) */}
        <div style={{
          position: "absolute", left: pct(policy.list_price) + "%", top: 0, bottom: 0,
          width: 1, borderLeft: "1px dashed rgba(241,196,107,0.4)",
          transform: "translateX(-0.5px)",
        }} />
        <div style={{
          position: "absolute", left: pct(policy.list_price) + "%", top: -18,
          transform: "translateX(-50%)",
          color: "#F1C46B", fontSize: 10, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
        }}>
          list {fmtPrice(policy.list_price, currencyMode)}
        </div>

        {/* Buyer track */}
        <TrackLabel y={BUYER_Y} color="#6EA8FE" handle={neg.transcript.buyer.handle} side="buyer" />
        {buyerSteps.length > 1 && (
          <PathConnector points={buyerSteps.map((e) => ({ x: pct(e.price), y: BUYER_Y }))} color="#6EA8FE" />
        )}
        {buyerSteps.map((e, i) => {
          const isLast = e === lastEvent;
          return (
            <PriceMarker
              key={"b" + i}
              x={pct(e.price)} y={BUYER_Y}
              color="#6EA8FE" round={e.round}
              price={fmtPrice(e.price, currencyMode)}
              kind={e.kind}
              isLast={isLast}
              showLabel={true}
              labelAbove={true}
            />
          );
        })}

        {/* Seller track */}
        <TrackLabel y={SELLER_Y} color="#F1C46B" handle={neg.transcript.seller.handle} side="seller" />
        {sellerSteps.length > 1 && (
          <PathConnector points={sellerSteps.map((e) => ({ x: pct(e.price), y: SELLER_Y }))} color="#F1C46B" />
        )}
        {sellerSteps.map((e, i) => {
          const isLast = e === lastEvent;
          return (
            <PriceMarker
              key={"s" + i}
              x={pct(e.price)} y={SELLER_Y}
              color="#F1C46B" round={e.round}
              price={fmtPrice(e.price, currencyMode)}
              kind={e.kind}
              isLast={isLast}
              showLabel={true}
              labelAbove={false}
            />
          );
        })}

        {/* Shim block dramatic marker */}
        {blocked && (
          <div style={{
            position: "absolute", left: pct(blocked.price) + "%",
            top: -8, bottom: -8, transform: "translateX(-50%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 36, height: TAPE_H + 16,
              border: "2px solid #FF6B6B", borderRadius: 4,
              background: "repeating-linear-gradient(135deg, rgba(255,107,107,0.18) 0 6px, rgba(255,107,107,0.05) 6px 12px)",
              display: "grid", placeItems: "center",
              color: "#FF6B6B", fontSize: 18, fontWeight: 700,
              boxShadow: "0 0 16px rgba(255,107,107,0.35)",
            }}>⊘</div>
          </div>
        )}
      </div>

      {/* Numeric ruler under the tape */}
      <div style={{ position: "relative", height: 18, marginTop: 4 }}>
        {ticks.filter((_, i) => i % (ticks.length > 8 ? 2 : 1) === 0).map((v) => (
          <div key={v} style={{
            position: "absolute", left: pct(v) + "%", transform: "translateX(-50%)",
            color: "#5C6068", fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          }}>
            {fmtPrice(v, currencyMode).replace(" USDC", "").replace("$", "$")}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: 18, marginTop: 8, fontSize: 11.5,
        fontFamily: "'Inter', sans-serif", color: "#9DA1A8", alignItems: "center",
      }}>
        <LegendDot color="#6EA8FE" label={`${neg.transcript.buyer.handle} (buyer offers)`} />
        <LegendDot color="#F1C46B" label={`${neg.transcript.seller.handle} (seller offers)`} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 8, background: "rgba(125,227,154,0.18)", border: "1px solid rgba(125,227,154,0.4)", display: "inline-block", borderRadius: 2 }} />
          zone of agreement
        </span>
        {blocked && (
          <span style={{ color: "#FF8B8B", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, border: "1.5px solid #FF6B6B", borderRadius: 2, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>⊘</span>
            shim blocked at {fmtPrice(blocked.price, currencyMode)}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ color: "#5C6068", fontSize: 11 }}>
          {priceEvents.length} {priceEvents.length === 1 ? "offer" : "offers"} · round {lastEvent?.round || 1} of {intent.max_rounds}
        </span>
      </div>
    </div>
  );
}

function BoundaryLine({ x, color, label, sub, side, tapeH }) {
  return (
    <>
      <div style={{
        position: "absolute", left: x + "%", top: -2, bottom: -2,
        width: 2, background: color, transform: "translateX(-1px)",
        boxShadow: `0 0 8px ${color}66`,
      }} />
      <div style={{
        position: "absolute", left: x + "%", top: -22,
        transform: side === "right" ? "translateX(-100%)" : side === "left" ? "translateX(0)" : "translateX(-50%)",
        paddingRight: side === "right" ? 6 : 0,
        paddingLeft: side === "left" ? 6 : 0,
        color, fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 600,
        whiteSpace: "nowrap",
      }}>
        {label} {sub}
      </div>
    </>
  );
}

function TrackLabel({ y, color, handle, side }) {
  return (
    <div style={{
      position: "absolute", left: 8, top: y, transform: "translateY(-50%)",
      color, fontSize: 10, fontFamily: "'Inter', sans-serif",
      letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600,
      pointerEvents: "none",
    }}>
      {side === "buyer" ? "↑" : "↓"} {handle}
    </div>
  );
}

function PathConnector({ points, color }) {
  if (points.length < 2) return null;
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} preserveAspectRatio="none">
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none" stroke={color} strokeWidth="1.5"
        strokeDasharray="3 3" opacity="0.5"
        vectorEffect="non-scaling-stroke"
        style={{ transition: "all 0.5s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

function PriceMarker({ x, y, color, round, price, kind, isLast, labelAbove }) {
  const size = isLast ? 16 : 10;
  return (
    <div style={{
      position: "absolute", left: x + "%", top: y, transform: "translate(-50%, -50%)",
      transition: "left 0.5s cubic-bezier(.4,0,.2,1)",
      pointerEvents: "none",
    }}>
      <div style={{
        position: "relative",
        width: size, height: size, borderRadius: 999,
        background: color,
        border: isLast ? "2px solid #FAFAF8" : "none",
        boxShadow: isLast ? `0 0 18px ${color}` : `0 0 4px ${color}66`,
      }}>
        {isLast && (
          <span style={{
            position: "absolute", inset: -4,
            border: `1.5px solid ${color}`, borderRadius: 999,
            opacity: 0.6,
            animation: "tape-pulse 1.4s ease-out infinite",
          }} />
        )}
      </div>
      {/* Round badge */}
      <div style={{
        position: "absolute", top: labelAbove ? -28 : 18,
        left: "50%", transform: "translateX(-50%)",
        whiteSpace: "nowrap",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      }}>
        <span style={{
          color: "#FAFAF8", fontSize: 12.5, fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          textShadow: "0 1px 4px rgba(0,0,0,0.7)",
          opacity: isLast ? 1 : 0.65,
        }}>
          {price}
        </span>
        <span style={{
          color: color, fontSize: 9.5, fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
          letterSpacing: "0.04em", textTransform: "uppercase",
          opacity: isLast ? 1 : 0.55,
        }}>
          r{round}{kind === "accept" ? " · accept" : ""}
        </span>
      </div>
      <style>{`@keyframes tape-pulse { 0%{transform:scale(0.9);opacity:0.7} 100%{transform:scale(1.8);opacity:0} }`}</style>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 999, display: "inline-block", boxShadow: `0 0 6px ${color}99` }} />
      {label}
    </span>
  );
}

Object.assign(window, { NegotiationTheater });
