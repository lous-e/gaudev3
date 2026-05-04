// Human view — Notion/Linear/Stripe-flavoured buyer dashboard
// Conventional patterns, generous spacing, soft warm-neutral palette.

const { useState: useStateH, useEffect: useEffectH, useMemo: useMemoH } = React;

const humanStyles = {
  shell: {
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
    background: "#FAFAF8",
    color: "#1B1B18",
    height: "100%",
    display: "grid",
    gridTemplateColumns: "232px 1fr",
    fontSize: 14,
    letterSpacing: "-0.005em",
    overflow: "hidden",
  },
  sidebar: {
    background: "#F4F3EF",
    borderRight: "1px solid #E8E6DF",
    padding: "20px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    overflow: "hidden",
  },
  navItem: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    borderRadius: 6,
    color: active ? "#1B1B18" : "#5C5A52",
    background: active ? "#E8E6DF" : "transparent",
    fontWeight: active ? 500 : 400,
    cursor: "pointer",
    fontSize: 13.5,
  }),
  main: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  topbar: {
    height: 52,
    borderBottom: "1px solid #E8E6DF",
    display: "flex",
    alignItems: "center",
    padding: "0 28px",
    gap: 16,
    background: "#FAFAF8",
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "32px 40px 80px",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid #E8E6DF",
    borderRadius: 10,
    padding: 20,
  },
  pill: (tone = "neutral") => {
    const tones = {
      neutral: { bg: "#F0EFEA", fg: "#5C5A52", bd: "#E0DED5" },
      green:   { bg: "#EAF2EA", fg: "#2F6B3A", bd: "#D5E5D6" },
      amber:   { bg: "#FAF1DC", fg: "#8A6500", bd: "#F0E2B0" },
      red:     { bg: "#F9EAEA", fg: "#9B2C2C", bd: "#F1D5D5" },
      sage:    { bg: "#EBF1EE", fg: "#3A6B5A", bd: "#D5E3DC" },
    };
    const t = tones[tone] || tones.neutral;
    return {
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 8px", borderRadius: 999,
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
      fontSize: 11.5, fontWeight: 500,
      letterSpacing: "0.005em",
    };
  },
  btn: (kind = "primary") => {
    if (kind === "primary") return {
      background: "#1B1B18", color: "#FAFAF8",
      border: "1px solid #1B1B18", borderRadius: 7,
      padding: "8px 14px", fontSize: 13, fontWeight: 500,
      cursor: "pointer", fontFamily: "inherit",
    };
    if (kind === "danger") return {
      background: "#FFF", color: "#9B2C2C",
      border: "1px solid #E5BFBF", borderRadius: 7,
      padding: "8px 14px", fontSize: 13, fontWeight: 500,
      cursor: "pointer", fontFamily: "inherit",
    };
    return {
      background: "#FFF", color: "#1B1B18",
      border: "1px solid #E0DED5", borderRadius: 7,
      padding: "8px 14px", fontSize: 13, fontWeight: 500,
      cursor: "pointer", fontFamily: "inherit",
    };
  },
  h1: { fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: "#1B1B18" },
  h2: { fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", margin: 0, color: "#1B1B18" },
  muted: { color: "#7A7872", fontSize: 13 },
  kbd: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 11.5, color: "#5C5A52",
    background: "#F0EFEA", border: "1px solid #E0DED5",
    padding: "1px 6px", borderRadius: 4,
  },
};

function HumanShell({ density = "default", currencyMode = "usdc", paceTrigger = 1, forceOverCap = false }) {
  const [tab, setTab] = useStateH("deals");
  return (
    <div style={humanStyles.shell}>
      <HumanSidebar tab={tab} setTab={setTab} />
      <div style={humanStyles.main}>
        <HumanTopbar />
        <div style={humanStyles.body}>
          {tab === "deals" && <HumanDealsHome density={density} currencyMode={currencyMode} paceTrigger={paceTrigger} forceOverCap={forceOverCap} />}
          {tab === "deal" && <HumanDealDetail currencyMode={currencyMode} paceTrigger={paceTrigger} forceOverCap={forceOverCap} />}
          {tab === "policies" && <HumanPolicies currencyMode={currencyMode} />}
          {tab === "audit" && <HumanAudit currencyMode={currencyMode} />}
        </div>
      </div>
    </div>
  );
}

function HumanSidebar({ tab, setTab }) {
  const items = [
    { id: "deals", label: "Deals", icon: "◇" },
    { id: "deal", label: "Live deal", icon: "●", badge: "1" },
    { id: "policies", label: "Spending policies", icon: "◈" },
    { id: "audit", label: "Audit log", icon: "◉" },
  ];
  return (
    <div style={humanStyles.sidebar}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px 14px" }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: "linear-gradient(135deg, #2C4F3D, #5A8268)",
          display: "grid", placeItems: "center",
          color: "#FAFAF8", fontWeight: 600, fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
        }}>B</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>BidMesh</div>
          <div style={{ fontSize: 11, color: "#7A7872" }}>tessa's agent</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#9B998E", padding: "8px 10px 4px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
        Workspace
      </div>
      {items.map((it) => (
        <div key={it.id} style={humanStyles.navItem(tab === it.id)} onClick={() => setTab(it.id)}>
          <span style={{ width: 14, color: "#9B998E", fontSize: 11 }}>{it.icon}</span>
          <span style={{ flex: 1 }}>{it.label}</span>
          {it.badge && (
            <span style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 999,
              background: "#2C4F3D", color: "#FAFAF8", fontWeight: 600,
            }}>{it.badge}</span>
          )}
        </div>
      ))}
      <div style={{ fontSize: 11, color: "#9B998E", padding: "20px 10px 4px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
        Discover
      </div>
      {[
        { id: "marketplace", label: "Marketplace", icon: "▤" },
        { id: "agents", label: "Trusted agents", icon: "◐" },
      ].map((it) => (
        <div key={it.id} style={humanStyles.navItem(false)}>
          <span style={{ width: 14, color: "#9B998E", fontSize: 11 }}>{it.icon}</span>
          <span style={{ flex: 1 }}>{it.label}</span>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ ...humanStyles.card, padding: 12, borderRadius: 8, background: "#FFFDF6", borderColor: "#F0E2B0" }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Spend cap this month</div>
        <div style={{ fontSize: 12, color: "#7A7872", marginBottom: 10 }}>$12.40 of $100.00 used</div>
        <div style={{ height: 4, background: "#F0E2B0", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: "12.4%", height: "100%", background: "#8A6500" }} />
        </div>
      </div>
    </div>
  );
}

function HumanTopbar() {
  return (
    <div style={humanStyles.topbar}>
      <div style={humanStyles.muted}>Workspace · Deals</div>
      <div style={{ flex: 1 }} />
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#F4F3EF", border: "1px solid #E8E6DF",
        borderRadius: 7, padding: "5px 10px", color: "#7A7872", fontSize: 13,
        minWidth: 280,
      }}>
        <span>⌕</span>
        <span style={{ flex: 1 }}>Search deals, agents, policies…</span>
        <span style={humanStyles.kbd}>⌘K</span>
      </div>
      <button style={humanStyles.btn("ghost")}>Invite agent</button>
      <button style={humanStyles.btn("primary")}>+ New intent</button>
    </div>
  );
}

// ─── Deals home ────────────────────────────────────────────────────────────
function HumanDealsHome({ density, currencyMode, paceTrigger, forceOverCap }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1080 }}>
      <div>
        <div style={humanStyles.muted}>Wednesday, May 4</div>
        <h1 style={{ ...humanStyles.h1, marginTop: 6 }}>Good afternoon, Tessa.</h1>
        <div style={{ ...humanStyles.muted, marginTop: 8 }}>
          Your agent has 1 active negotiation and is watching 3 listings.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Stat label="Active deals" value="1" sub="negotiating now" tone="sage" />
        <Stat label="Settled this month" value="14" sub="all under cap" />
        <Stat label="Saved vs list" value="$23.18" sub="across 14 deals" tone="green" />
        <Stat label="Blocked by shim" value="2" sub="never your money" tone="amber" />
      </div>

      <ActiveDealCard currencyMode={currencyMode} paceTrigger={paceTrigger} forceOverCap={forceOverCap} />

      <div>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={humanStyles.h2}>Recent deals</h2>
          <div style={{ flex: 1 }} />
          <div style={humanStyles.muted}>Last 7 days</div>
        </div>
        <RecentDealsTable density={density} currencyMode={currencyMode} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "neutral" }) {
  const accent = { neutral: "#1B1B18", sage: "#3A6B5A", green: "#2F6B3A", amber: "#8A6500" }[tone];
  return (
    <div style={humanStyles.card}>
      <div style={{ ...humanStyles.muted, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: accent, marginTop: 4, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ ...humanStyles.muted, fontSize: 12, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function ActiveDealCard({ currencyMode, paceTrigger, forceOverCap }) {
  const neg = useNegotiation({ pace: paceTrigger, forceOverCap, autoplay: true });
  const lastPriceEvent = [...neg.events].reverse().find((e) => e.price != null && (e.kind === "open" || e.kind === "counter" || e.kind === "accept"));
  const currentPrice = lastPriceEvent?.price ?? null;
  const lastSide = lastPriceEvent?.side ?? null;
  const settled = neg.transcript.settled && neg.step >= neg.totalSteps;
  const phase = neg.transcript.walked
    ? "walked"
    : settled
      ? "settled"
      : neg.events.find((e) => e.kind === "confirm-request" && neg.step > neg.events.indexOf(e))
        ? "awaiting-confirmation"
        : "negotiating";

  const intent = neg.transcript.intent;

  return (
    <div style={{ ...humanStyles.card, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #E8E6DF", display: "flex", alignItems: "center", gap: 12 }}>
        <PulsingDot />
        <div style={{ fontWeight: 600, fontSize: 14 }}>Live negotiation</div>
        <span style={humanStyles.pill(phase === "settled" ? "green" : phase === "walked" ? "red" : "sage")}>
          {phase === "negotiating" && "round " + (neg.current?.round ?? 1) + " of " + intent.max_rounds}
          {phase === "awaiting-confirmation" && "awaiting your confirmation"}
          {phase === "settled" && "settled"}
          {phase === "walked" && "walked"}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ ...humanStyles.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
          {neg.transcript.dealId}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 0 }}>
        {/* Item + parties */}
        <div style={{ padding: 20, borderRight: "1px solid #E8E6DF" }}>
          <div style={{ ...humanStyles.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>Item</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6, letterSpacing: "-0.01em" }}>{intent.item}</div>
          <div style={{ ...humanStyles.muted, marginTop: 2 }}>×{intent.quantity} · 1m, ≥60W PD</div>

          <div style={{ height: 16 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AgentGlyph seed={neg.transcript.buyer.handle} size={28} />
            <div>
              <div style={{ fontWeight: 500 }}>{neg.transcript.buyer.handle}</div>
              <div style={{ ...humanStyles.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                {shortPubkey(neg.transcript.buyer.pubkey)}
              </div>
            </div>
          </div>
          <div style={{ ...humanStyles.muted, fontSize: 12, padding: "10px 0 8px", textAlign: "center" }}>negotiating with</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AgentGlyph seed={neg.transcript.seller.handle} size={28} />
            <div>
              <div style={{ fontWeight: 500 }}>{neg.transcript.seller.handle}</div>
              <div style={{ ...humanStyles.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                {shortPubkey(neg.transcript.seller.pubkey)}
              </div>
            </div>
          </div>
        </div>

        {/* Price ladder */}
        <div style={{ padding: 20, borderRight: "1px solid #E8E6DF" }}>
          <div style={{ ...humanStyles.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>Current offer</div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
            {currentPrice != null ? fmtPrice(currentPrice, currencyMode) : "—"}
          </div>
          <div style={{ ...humanStyles.muted, fontSize: 12, marginTop: 4 }}>
            from {lastSide === "buyer" ? "your agent" : lastSide === "seller" ? neg.transcript.seller.handle : "—"}
          </div>

          <div style={{ height: 16 }} />
          <PriceLadder
            target={intent.target_price}
            max={intent.max_price}
            current={currentPrice}
            currencyMode={currencyMode}
          />
        </div>

        {/* Live transcript */}
        <div style={{ padding: 20, background: "#FCFBF8" }}>
          <div style={{ ...humanStyles.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, marginBottom: 10 }}>
            Activity
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflow: "auto" }}>
            {neg.events.slice(-7).map((e, i) => (
              <ActivityRow key={i} event={e} currencyMode={currencyMode} parties={{ buyer: neg.transcript.buyer, seller: neg.transcript.seller }} />
            ))}
            {phase === "awaiting-confirmation" && <ConfirmInline price={currentPrice} currencyMode={currencyMode} />}
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 20px", borderTop: "1px solid #E8E6DF", display: "flex", alignItems: "center", gap: 10, background: "#FCFBF8" }}>
        <span style={humanStyles.pill("neutral")}>cap {fmtPrice(intent.max_price, currencyMode)}</span>
        <span style={humanStyles.pill("neutral")}>target {fmtPrice(intent.target_price, currencyMode)}</span>
        <span style={humanStyles.pill("neutral")}>max rounds {intent.max_rounds}</span>
        <div style={{ flex: 1 }} />
        <button style={humanStyles.btn("ghost")} onClick={neg.restart}>↻ Replay</button>
        <button style={humanStyles.btn("ghost")} onClick={neg.playing ? neg.pause : neg.play}>
          {neg.playing ? "❚❚ Pause" : "▶ Play"}
        </button>
      </div>
    </div>
  );
}

function PulsingDot() {
  return (
    <span style={{ position: "relative", width: 8, height: 8 }}>
      <span style={{
        position: "absolute", inset: 0,
        background: "#5A8268", borderRadius: 999,
      }} />
      <span style={{
        position: "absolute", inset: -3,
        border: "2px solid #5A8268", borderRadius: 999,
        opacity: 0.5,
        animation: "human-pulse 1.6s ease-out infinite",
      }} />
      <style>{`@keyframes human-pulse { 0%{transform:scale(0.6);opacity:0.6} 100%{transform:scale(1.6);opacity:0} }`}</style>
    </span>
  );
}

function PriceLadder({ target, max, current, currencyMode }) {
  // Visual: a horizontal scale from 0 → max+buffer with target & max marks + current dot
  const lo = Math.max(0, (target ?? 0) * 0.6);
  const hi = max * 1.25;
  const pct = (n) => Math.min(100, Math.max(0, ((n - lo) / (hi - lo)) * 100));

  return (
    <div>
      <div style={{ position: "relative", height: 6, background: "#F0EFEA", borderRadius: 999 }}>
        {/* zone: target → max = comfortable */}
        <div style={{
          position: "absolute", left: pct(target) + "%", width: (pct(max) - pct(target)) + "%",
          top: 0, bottom: 0, background: "#D5E5D6", borderRadius: 999,
        }} />
        {/* over-cap */}
        <div style={{
          position: "absolute", left: pct(max) + "%", right: 0,
          top: 0, bottom: 0, background: "repeating-linear-gradient(45deg, #F9EAEA, #F9EAEA 4px, transparent 4px, transparent 8px)",
          borderRadius: "0 999px 999px 0",
        }} />
        {/* current */}
        {current != null && (
          <div style={{
            position: "absolute", left: pct(current) + "%", top: -4,
            width: 14, height: 14, borderRadius: 999,
            background: "#1B1B18", border: "3px solid #FAFAF8",
            transform: "translateX(-7px)",
            transition: "left 0.6s cubic-bezier(.4,0,.2,1)",
          }} />
        )}
      </div>
      <div style={{ display: "flex", marginTop: 10, fontSize: 11, color: "#7A7872", fontFamily: "'JetBrains Mono', monospace" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <div style={{ position: "absolute", left: pct(target) + "%", transform: "translateX(-50%)" }}>
            <div style={{ width: 1, height: 6, background: "#7A7872", margin: "0 auto" }} />
            <div style={{ marginTop: 2 }}>target {fmtPrice(target, currencyMode)}</div>
          </div>
          <div style={{ position: "absolute", left: pct(max) + "%", transform: "translateX(-50%)" }}>
            <div style={{ width: 1, height: 6, background: "#9B2C2C", margin: "0 auto" }} />
            <div style={{ marginTop: 2, color: "#9B2C2C" }}>cap {fmtPrice(max, currencyMode)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ event, currencyMode, parties }) {
  const e = event;
  const sideLabel = e.side === "buyer" ? parties.buyer.handle
                  : e.side === "seller" ? parties.seller.handle
                  : e.side === "shim" ? "validation shim"
                  : e.side === "human" ? "you" : e.side;
  const tone = e.kind === "block" ? "red"
            : e.kind === "walk" ? "red"
            : e.kind === "settle" || e.kind === "artifact" || e.kind === "accept" ? "green"
            : e.kind === "confirm-request" ? "amber"
            : "neutral";
  const verb = {
    open: "opened at",
    counter: "countered with",
    accept: "accepted at",
    walk: "walked",
    block: "blocked offer of",
    "confirm-request": "asks you to confirm",
    "confirm-granted": "confirmed",
    settle: "paid",
    artifact: "delivered",
  }[e.kind] || e.kind;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 }}>
      <span style={{ ...humanStyles.pill(tone), fontSize: 10, padding: "1px 6px", marginTop: 2, flexShrink: 0 }}>
        r{e.round}
      </span>
      <div style={{ flex: 1, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 500 }}>{sideLabel}</span>{" "}
        <span style={{ color: "#5C5A52" }}>{verb}</span>
        {e.price != null && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, marginLeft: 4 }}>
            {fmtPrice(e.price, currencyMode)}
          </span>
        )}
        {e.artifact && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginLeft: 4, color: "#3A6B5A" }}>
            {e.artifact}
          </span>
        )}
        {e.txHash && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginLeft: 4, color: "#3A6B5A" }}>
            {e.txHash}
          </span>
        )}
        {e.reason_code && (
          <div style={{ ...humanStyles.muted, fontSize: 11, marginTop: 1 }}>{e.reason_code}</div>
        )}
      </div>
    </div>
  );
}

function ConfirmInline({ price, currencyMode }) {
  return (
    <div style={{
      marginTop: 6, padding: 12,
      background: "#FFFDF6", border: "1px solid #F0E2B0", borderRadius: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#8A6500", marginBottom: 4 }}>Confirm purchase</div>
      <div style={{ fontSize: 13, color: "#5C5A52", lineHeight: 1.5 }}>
        Pay <strong style={{ color: "#1B1B18", fontFamily: "'JetBrains Mono', monospace" }}>{fmtPrice(price, currencyMode)}</strong> for the agreed deal?
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button style={humanStyles.btn("primary")}>Confirm payment</button>
        <button style={humanStyles.btn("ghost")}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Recent deals table ────────────────────────────────────────────────────
const RECENT_DEALS = [
  { item: "USB-C cable, 2m, 100W", agent: "tessa.agent", seller: "cableworks.agent", final: 4.75, cap: 5, status: "settled", when: "2h ago", saved: 1.25 },
  { item: "Logitech MX Master 3S", agent: "tessa.agent", seller: "deskwarehouse", final: 87.50, cap: 95, status: "settled", when: "yesterday", saved: 12.49 },
  { item: "API credits, 100k Anthropic", agent: "tessa.agent", seller: "creditpool", final: 80.00, cap: 80, status: "settled", when: "yesterday", saved: 0 },
  { item: "Domain · luminate.dev", agent: "tessa.agent", seller: "ndns-registry", final: null, cap: 30, status: "walked", when: "2d ago", saved: 0, reason: "above cap" },
  { item: "Concert · Caroline Polachek", agent: "tessa.agent", seller: "tixrelay", final: 42.00, cap: 50, status: "settled", when: "3d ago", saved: 8 },
  { item: "Forced 7 USDC test deal", agent: "tessa.agent", seller: "test-seller", final: null, cap: 5, status: "blocked", when: "4d ago", saved: 0, reason: "shim · over cap" },
];

function RecentDealsTable({ density, currencyMode }) {
  const rowPad = density === "dense" ? "10px 14px" : "14px 16px";
  return (
    <div style={{ ...humanStyles.card, padding: 0, overflow: "hidden" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "2.4fr 1.4fr 1fr 1fr 0.9fr 0.9fr",
        padding: "10px 16px", borderBottom: "1px solid #E8E6DF",
        fontSize: 11, color: "#7A7872", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500,
        background: "#FCFBF8",
      }}>
        <div>Item</div><div>Seller agent</div><div>Final</div><div>Cap</div><div>Status</div><div style={{ textAlign: "right" }}>When</div>
      </div>
      {RECENT_DEALS.map((d, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "2.4fr 1.4fr 1fr 1fr 0.9fr 0.9fr",
          padding: rowPad, borderBottom: i === RECENT_DEALS.length - 1 ? "none" : "1px solid #F0EFEA",
          alignItems: "center", fontSize: 13,
        }}>
          <div style={{ fontWeight: 500 }}>{d.item}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AgentGlyph seed={d.seller} size={20} />
            <span style={{ color: "#5C5A52" }}>{d.seller}</span>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
            {d.final != null ? fmtPrice(d.final, currencyMode) : <span style={{ color: "#9B998E" }}>—</span>}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7A7872" }}>
            {fmtPrice(d.cap, currencyMode)}
          </div>
          <div>
            <span style={humanStyles.pill(
              d.status === "settled" ? "green" : d.status === "blocked" ? "red" : "neutral"
            )}>
              {d.status === "settled" && "✓ settled"}
              {d.status === "walked" && "↩ walked"}
              {d.status === "blocked" && "⊘ blocked"}
            </span>
          </div>
          <div style={{ textAlign: "right", color: "#7A7872", fontSize: 12 }}>{d.when}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Deal detail (a focused view of one deal) ──────────────────────────────
function HumanDealDetail({ currencyMode, paceTrigger, forceOverCap }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 980 }}>
      <div>
        <div style={humanStyles.muted}>← Deals / Live deal</div>
        <h1 style={{ ...humanStyles.h1, marginTop: 6 }}>USB-C cable</h1>
        <div style={{ ...humanStyles.muted, marginTop: 6 }}>
          Negotiating since 2:14 PM · 1m, ≥60W PD · cap {fmtPrice(5, currencyMode)} · target {fmtPrice(4, currencyMode)}
        </div>
      </div>
      <ActiveDealCard currencyMode={currencyMode} paceTrigger={paceTrigger} forceOverCap={forceOverCap} />
    </div>
  );
}

// ─── Policies ──────────────────────────────────────────────────────────────
function HumanPolicies({ currencyMode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 760 }}>
      <div>
        <h1 style={humanStyles.h1}>Spending policies</h1>
        <div style={{ ...humanStyles.muted, marginTop: 6 }}>
          Your agent operates inside these limits. Validation shims enforce them deterministically — no LLM can override them.
        </div>
      </div>

      <div style={humanStyles.card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 style={humanStyles.h2}>USB-C cable intent</h2>
          <span style={{ ...humanStyles.pill("sage"), marginLeft: 10 }}>active</span>
          <div style={{ flex: 1 }} />
          <button style={humanStyles.btn("ghost")}>Edit</button>
        </div>

        <PolicyRow label="Item" value="USB-C cable" sub="must support ≥60W PD, 1m length" />
        <PolicyRow label="Quantity" value="1" />
        <PolicyRow label="Maximum price" value={fmtPrice(5, currencyMode)} sub="hard cap — shim blocks above this" tone="red" />
        <PolicyRow label="Target price" value={fmtPrice(4, currencyMode)} sub="agent accepts immediately at or below" tone="sage" />
        <PolicyRow label="Currency" value="USDC on base-sepolia" />
        <PolicyRow label="Max rounds" value="3" sub="walk after this many counters" />
        <PolicyRow label="Negotiation style" value="balanced" sub="firm · balanced · eager" />
        <PolicyRow label="Confirmation" value="Required before payment" sub="you sign off in Telegram or here" tone="amber" last />
      </div>

      <div style={humanStyles.card}>
        <h2 style={humanStyles.h2}>Monthly spend cap</h2>
        <div style={{ ...humanStyles.muted, marginTop: 4, marginBottom: 14 }}>
          Across all of your agent's deals.
        </div>
        <div style={{ height: 8, background: "#F0EFEA", borderRadius: 999 }}>
          <div style={{ width: "12.4%", height: "100%", background: "#3A6B5A", borderRadius: 999 }} />
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 12, color: "#7A7872" }}>
          <div>$12.40 used</div>
          <div style={{ flex: 1 }} />
          <div>$87.60 remaining of $100.00</div>
        </div>
      </div>
    </div>
  );
}

function PolicyRow({ label, value, sub, tone = "neutral", last }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "180px 1fr",
      padding: "14px 0", gap: 16,
      borderBottom: last ? "none" : "1px solid #F0EFEA",
      alignItems: "baseline",
    }}>
      <div style={{ fontSize: 13, color: "#5C5A52" }}>{label}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, fontFamily: tone === "red" || tone === "sage" ? "'JetBrains Mono', monospace" : "inherit",
                       color: tone === "red" ? "#9B2C2C" : tone === "sage" ? "#3A6B5A" : tone === "amber" ? "#8A6500" : "#1B1B18" }}>
          {value}
        </div>
        {sub && <div style={{ ...humanStyles.muted, fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Audit log ─────────────────────────────────────────────────────────────
function HumanAudit({ currencyMode }) {
  const entries = [
    { ts: "2026-05-04 14:17:32", action: "settle", price: 4.75, cap: 5, allowed: true, deal: "deal_a93kf2" },
    { ts: "2026-05-04 14:17:18", action: "accept", price: 4.75, cap: 5, allowed: true, deal: "deal_a93kf2" },
    { ts: "2026-05-04 14:17:09", action: "counter", price: 4.50, cap: 5, allowed: true, deal: "deal_a93kf2" },
    { ts: "2026-05-04 14:16:58", action: "open", price: 4.00, cap: 5, allowed: true, deal: "deal_a93kf2" },
    { ts: "2026-05-01 09:02:12", action: "blocked", price: 7.00, cap: 5, allowed: false, deal: "deal_q1mz8x", reason: "accepted_price_exceeds_max_price" },
    { ts: "2026-04-30 18:44:01", action: "walk", price: 6.20, cap: 5, allowed: true, deal: "deal_pp4w0a", reason: "round_limit" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
      <div>
        <h1 style={humanStyles.h1}>Audit log</h1>
        <div style={{ ...humanStyles.muted, marginTop: 6 }}>
          Append-only. Every offer, counter, accept, walk, block, and settle. Receipts for the trillion-agent economy.
        </div>
      </div>
      <div style={{ ...humanStyles.card, padding: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "180px 100px 1fr 100px 100px 80px",
          padding: "10px 14px", borderBottom: "1px solid #E8E6DF",
          fontSize: 11, color: "#7A7872", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500,
          background: "#FCFBF8",
        }}>
          <div>timestamp</div><div>action</div><div>deal_id / reason</div><div>price</div><div>cap</div><div>allowed</div>
        </div>
        {entries.map((e, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "180px 100px 1fr 100px 100px 80px",
            padding: "10px 14px",
            borderBottom: i === entries.length - 1 ? "none" : "1px solid #F0EFEA",
            color: e.allowed ? "#1B1B18" : "#9B2C2C",
            background: e.allowed ? "transparent" : "#FFF7F7",
          }}>
            <div style={{ color: "#7A7872" }}>{e.ts}</div>
            <div style={{ fontWeight: 500 }}>{e.action}</div>
            <div>
              <span>{e.deal}</span>
              {e.reason && <span style={{ color: "#9B2C2C", marginLeft: 8 }}>· {e.reason}</span>}
            </div>
            <div>{e.price.toFixed(2)}</div>
            <div style={{ color: "#7A7872" }}>{e.cap.toFixed(2)}</div>
            <div>{e.allowed ? "true" : "false"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { HumanShell });
