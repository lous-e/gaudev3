// BidMesh — Agent UI Kit · Shell (rail / topbar / inspector)

function ARail({ tab, setTab }) {
  const items = [
    { id: "session", label: "negotiate" },
    { id: "mcp", label: "mcp/api" },
    { id: "audit", label: "audit.log" },
  ];
  const navItem = (active) => ({
    padding: "5px 10px",
    color: active ? A.green : A.fg3,
    background: active ? "rgba(125,227,154,0.06)" : "transparent",
    borderLeft: `2px solid ${active ? A.green : "transparent"}`,
    cursor: "pointer", fontSize: 11.5, letterSpacing: "0.02em",
  });
  const sec = { color: A.fg5, fontSize: 9.5, padding: "16px 12px 2px", letterSpacing: "0.08em" };

  return (
    <div style={{
      background: A.bg2, borderRight: `1px solid ${A.border}`,
      padding: "14px 10px", display: "flex", flexDirection: "column", gap: 2, overflow: "hidden",
    }}>
      <div style={{ padding: "0 8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 16, height: 16, background: A.green,
          display: "grid", placeItems: "center",
          color: A.bg, fontWeight: 700, fontSize: 10, fontFamily: A.font,
        }}>$</div>
        <span style={{ color: A.green, fontWeight: 600, fontSize: 12 }}>bidmesh</span>
        <span style={{ color: A.fg5, fontSize: 10 }}>v1.0.0</span>
      </div>

      <div style={{ ...sec, paddingTop: "4px" }}>SESSION</div>
      {items.map((it) => (
        <div key={it.id} style={navItem(tab === it.id)} onClick={() => setTab(it.id)}>
          {tab === it.id ? "▸ " : "  "}{it.label}
        </div>
      ))}

      <div style={sec}>NUFFV1</div>
      {["open", "counter", "accept", "walk", "status"].map((m) => (
        <div key={m} style={{ ...navItem(false), fontSize: 11 }}>
          <span style={{ color: A.blue }}>·</span> {m}
        </div>
      ))}

      <div style={{ flex: 1 }} />
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${A.border}`, color: A.fg5, fontSize: 10, lineHeight: 1.5 }}>
        <div style={{ color: A.green }}>● connected</div>
        <div>shim: enforced</div>
        <div>net: base-sepolia</div>
      </div>
    </div>
  );
}

function ATopbar({ session = "deal_a93kf2", round = "3", phase = "live" }) {
  return (
    <div style={{
      height: 36, borderBottom: `1px solid ${A.border}`,
      display: "flex", alignItems: "center", padding: "0 14px",
      gap: 12, color: A.fg3, fontSize: 11, flexShrink: 0, fontFamily: A.font,
    }}>
      <span style={{ color: A.green }}>tessa.agent@bidmesh</span>
      <span style={{ color: A.fg5 }}>:</span>
      <span style={{ color: A.blue }}>~/sessions/{session}</span>
      <span style={{ color: A.fg5 }}>$</span>
      <div style={{ flex: 1 }} />
      <APill tone={phase === "settled" ? "green" : phase === "walked" ? "amber" : "green"}>● {phase}</APill>
      <span style={{ color: A.fg3 }}>round {round}</span>
    </div>
  );
}

function AInspector({ deal }) {
  const sellerFloor = deal?.seller?.policy?.min_price;
  const sellerList = deal?.seller?.policy?.list_price ?? deal?.seller?.listing?.list_price;
  const fields = [
    ["intent.id", deal?.deal_id ?? "none"],
    ["intent.item", deal?.item ?? "none"],
    ["intent.qty", String(deal?.quantity ?? 0)],
    ["intent.target_price", "4.00 USDC"],
    ["intent.max_price", "5.00 USDC"],
    ["intent.max_rounds", String(deal?.round ?? 0)],
    ["policy.shim", "enforced"],
    ["policy.min_price", sellerFloor != null ? `${sellerFloor.toFixed(2)} USDC` : sellerList != null ? `list ${sellerList.toFixed(2)} USDC` : "—"],
    ["seller.handle", deal?.seller?.handle ?? "none"],
    ["seller.pubkey", deal?.seller?.pubkey ?? "none"],
    ["transport", "x402 / base-sepolia"],
    ["sdk", "@bidmesh/sdk@1.0.0"],
  ];
  return (
    <div style={{ background: A.bg2, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: A.font, fontSize: 11 }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${A.border}`, color: A.green, letterSpacing: "0.05em", fontSize: 11 }}>
        // INSPECTOR · session
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6, color: A.fg2 }}>
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
            <span style={{ color: A.fg5 }}>{k}</span>
            <span style={{ color: k.startsWith("intent.max") ? A.amber : k.startsWith("policy") ? A.green : A.fg }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${A.border}`, padding: "10px 14px", color: A.green, fontSize: 11 }}>// SCHEMA</div>
      <pre style={{
        margin: 0, padding: "8px 14px", color: A.fg3, fontSize: 10.5, lineHeight: 1.55,
        whiteSpace: "pre-wrap",
      }}>
{`type Envelope = {
  v: "nuff/1"
  method: "negotiate.open"
       | "negotiate.counter"
       | "negotiate.accept"
       | "negotiate.walk"
  from: PubKey
  body: Counter
  sig: Signature
}`}
      </pre>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${A.border}`, color: A.fg5, fontSize: 10, lineHeight: 1.6 }}>
        <div>spec · <span style={{ color: A.blue }}>./vision.md</span></div>
        <div>build · <span style={{ color: A.blue }}>./plan.md</span></div>
      </div>
    </div>
  );
}

function AShell({ tab, setTab, children, topbarSession, topbarRound, topbarPhase, inspectorDeal }) {
  return (
    <div style={{
      fontFamily: A.font, background: A.bg, color: A.fg,
      height: "100%", display: "grid", gridTemplateColumns: "180px 1fr 320px",
      fontSize: 12, overflow: "hidden",
    }}>
      <ARail tab={tab} setTab={setTab} />
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderRight: `1px solid ${A.border}` }}>
        <ATopbar session={topbarSession} round={topbarRound} phase={topbarPhase} />
        <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
      </div>
      <AInspector deal={inspectorDeal} />
    </div>
  );
}

Object.assign(window, { ARail, ATopbar, AInspector, AShell });
