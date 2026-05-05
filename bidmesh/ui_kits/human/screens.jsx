// BidMesh — Human UI Kit · Screens

// ─── DealsHome ────────────────────────────────────────────────────────
function HDealsHome({ onOpenDeal }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1080 }}>
      <div>
        <div style={{ color: H.fg3, fontSize: 13 }}>Wednesday, May 4</div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "6px 0 0", color: H.fg }}>Good afternoon, Tessa.</h1>
        <div style={{ color: H.fg3, fontSize: 13, marginTop: 8 }}>
          Your agent has 1 active negotiation and is watching 3 listings.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <HStat label="Active deals" value="1" sub="negotiating now" tone="sage" />
        <HStat label="Settled this month" value="14" sub="all under cap" />
        <HStat label="Saved vs list" value="$23.18" sub="across 14 deals" tone="green" />
        <HStat label="Blocked by shim" value="2" sub="never your money" tone="amber" />
      </div>

      <HLiveDealCard onOpen={onOpenDeal} />

      <div>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Recent deals</h2>
          <div style={{ flex: 1 }} />
          <div style={{ color: H.fg3, fontSize: 13 }}>Last 7 days</div>
        </div>
        <HRecentDealsTable />
      </div>
    </div>
  );
}

// ─── Live deal card (compact, links to detail) ───────────────────────
function HLiveDealCard({ onOpen }) {
  return (
    <HCard padding={0}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${H.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <HPulsingDot />
        <div style={{ fontWeight: 600, fontSize: 14 }}>Live negotiation</div>
        <HPill tone="sage">round 3 of 3</HPill>
        <div style={{ flex: 1 }} />
        <div style={{ color: H.fg3, fontFamily: H.mono, fontSize: 11 }}>deal_a93kf2</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 0 }}>
        <div style={{ padding: 20, borderRight: `1px solid ${H.border}` }}>
          <HEyebrow>Item</HEyebrow>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6, letterSpacing: "-0.01em" }}>USB-C cable, 1m, 60W PD</div>
          <div style={{ color: H.fg3, fontSize: 13, marginTop: 2 }}>×1 · 1m, ≥60W PD</div>
          <div style={{ height: 16 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AgentGlyph seed="tessa.agent" size={28} />
            <div>
              <div style={{ fontWeight: 500 }}>tessa.agent</div>
              <div style={{ color: H.fg3, fontFamily: H.mono, fontSize: 11 }}>{shortPubkey("0x4a3f1c2e8b9d6a4c5e7f8d2b1a3c0de")}</div>
            </div>
          </div>
          <div style={{ color: H.fg3, fontSize: 12, padding: "10px 0 8px", textAlign: "center" }}>negotiating with</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AgentGlyph seed="cableworks.agent" size={28} />
            <div>
              <div style={{ fontWeight: 500 }}>cableworks.agent</div>
              <div style={{ color: H.fg3, fontFamily: H.mono, fontSize: 11 }}>{shortPubkey("0x9b21f7c8a4d2e1c3b5a87c2d6e4f7c8a")}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 20, borderRight: `1px solid ${H.border}` }}>
          <HEyebrow>Current offer</HEyebrow>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 6, fontFamily: H.mono }}>4.75 USDC</div>
          <div style={{ color: H.fg3, fontSize: 12, marginTop: 4 }}>from cableworks.agent</div>
          <div style={{ height: 16 }} />
          <HPriceLadder target={4.00} max={5.00} current={4.75} />
        </div>

        <div style={{ padding: 20, background: H.surfSoft }}>
          <HEyebrow>Activity</HEyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, maxHeight: 220, overflow: "auto" }}>
            <HActivityRow side="buyer" who="your agent" text="opened at 4.00 USDC" t="00:00" />
            <HActivityRow side="seller" who="cableworks.agent" text="countered 5.50 USDC" t="00:01" />
            <HActivityRow side="buyer" who="your agent" text="countered 4.40 USDC" t="00:01" />
            <HActivityRow side="seller" who="cableworks.agent" text="countered 4.75 USDC" t="00:02" />
            <HActivityRow side="shim" text="within cap · ready to settle" t="00:02" tone="sage" />
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 20px", borderTop: `1px solid ${H.border}`, display: "flex", alignItems: "center", gap: 10, background: H.surfSoft }}>
        <HPill>cap 5.00 USDC</HPill>
        <HPill>target 4.00 USDC</HPill>
        <HPill>max rounds 3</HPill>
        <div style={{ flex: 1 }} />
        <HButton size="sm">↻ Replay</HButton>
        <HButton size="sm">▶ Play</HButton>
        <HButton size="sm" kind="primary" onClick={onOpen}>Open deal →</HButton>
      </div>
    </HCard>
  );
}

function HPriceLadder({ target, max, current }) {
  const lo = target * 0.6, hi = max * 1.25;
  const pct = (n) => Math.min(100, Math.max(0, ((n - lo) / (hi - lo)) * 100));
  return (
    <div>
      <div style={{ position: "relative", height: 6, background: H.bg3, borderRadius: 999 }}>
        <div style={{ position: "absolute", left: pct(target) + "%", width: (pct(max) - pct(target)) + "%", top: 0, bottom: 0, background: H.successBd, borderRadius: 999 }} />
        <div style={{ position: "absolute", left: pct(max) + "%", right: 0, top: 0, bottom: 0, background: H.dangerBd, borderRadius: 999 }} />
        <div style={{
          position: "absolute", left: pct(current) + "%", top: -3, width: 12, height: 12,
          marginLeft: -6, background: H.fg, borderRadius: 999, border: `2px solid ${H.bg}`,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: H.fg3, fontFamily: H.mono }}>
        <span>target {target.toFixed(2)}</span>
        <span style={{ color: H.warn }}>cap {max.toFixed(2)}</span>
      </div>
    </div>
  );
}

function HActivityRow({ side = "buyer", who, text, t, tone }) {
  const arrow = side === "buyer" ? "↑" : side === "seller" ? "↓" : "·";
  const arrowColor = side === "buyer" ? H.accentMid : side === "seller" ? H.warn : H.fg4;
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.4 }}>
      <span style={{ color: arrowColor, fontFamily: H.mono, width: 14 }}>{arrow}</span>
      <div style={{ flex: 1 }}>
        {who && <strong style={{ fontWeight: 500 }}>{who}</strong>}
        {who && " "}
        <span style={{ color: H.fg2 }}>{text}</span>
      </div>
      <span style={{ color: H.fg4, fontFamily: H.mono, fontSize: 11 }}>{t}</span>
    </div>
  );
}

// ─── Recent deals table ──────────────────────────────────────────────
function HRecentDealsTable() {
  const rows = [
    { id: "deal_a93kf2", item: "USB-C cable, 1m", agent: "cableworks.agent", price: "4.75 USDC", saved: "+$0.25", status: "live", tone: "sage" },
    { id: "deal_84jk3d", item: "Standing desk mat", agent: "deskwarehouse", price: "32.00 USDC", saved: "+$8.00", status: "settled", tone: "green" },
    { id: "deal_72bn5x", item: "domain · ndns lookup", agent: "ndns-registry", price: "12.00 USDC", saved: "+$3.00", status: "settled", tone: "green" },
    { id: "deal_6f1ab9", item: "Compute hours · 4×A100", agent: "compute-mesh", price: "—", saved: "—", status: "blocked", tone: "amber" },
    { id: "deal_5dz0a1", item: "Cinema tickets · 2 seats", agent: "tixrelay", price: "—", saved: "—", status: "walked", tone: "neutral" },
  ];
  return (
    <HCard padding={0}>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.8fr 0.7fr 0.8fr 0.7fr", padding: "10px 16px", color: H.fg3, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, borderBottom: `1px solid ${H.border}`, background: H.surfSoft }}>
        <div>Deal</div><div>Counterparty</div><div>Price</div><div>Saved</div><div>Status</div><div style={{ textAlign: "right" }}>ID</div>
      </div>
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.8fr 0.7fr 0.8fr 0.7fr", padding: "12px 16px", fontSize: 13, alignItems: "center", borderBottom: i < rows.length - 1 ? `1px solid ${H.border}` : "none" }}>
          <div style={{ fontWeight: 500 }}>{r.item}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AgentGlyph seed={r.agent} size={20} />
            <span style={{ color: H.fg2 }}>{r.agent}</span>
          </div>
          <div style={{ fontFamily: H.mono, color: H.fg }}>{r.price}</div>
          <div style={{ color: r.saved.startsWith("+") ? H.success : H.fg3, fontFamily: H.mono }}>{r.saved}</div>
          <div><HPill tone={r.tone}>{r.status === "live" && "● "}{r.status === "settled" && "✓ "}{r.status === "blocked" && "⊘ "}{r.status === "walked" && "↩ "}{r.status}</HPill></div>
          <div style={{ textAlign: "right", fontFamily: H.mono, color: H.fg3, fontSize: 11 }}>{r.id}</div>
        </div>
      ))}
    </HCard>
  );
}

// ─── Deal detail (full live deal page) ────────────────────────────────
function HDealDetail({ onConfirm, confirmed }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1080 }}>
      <div>
        <div style={{ color: H.fg3, fontSize: 13 }}>
          <span>Deals</span> <span style={{ color: H.fg4 }}>›</span> <span>USB-C cable, 1m</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "6px 0 0" }}>USB-C cable, 1m, 60W PD</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <HPulsingDot /><span style={{ color: H.fg3, fontSize: 13 }}>negotiating with cableworks.agent · round 3 of 3</span>
          <span style={{ color: H.fg4, fontFamily: H.mono, fontSize: 11 }}>deal_a93kf2 · {shortPubkey()}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <HCard>
          <HEyebrow>Current offer</HEyebrow>
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 6, fontFamily: H.mono }}>4.75 USDC</div>
          <div style={{ color: H.fg3, fontSize: 13, marginTop: 4 }}>from <strong style={{ color: H.fg }}>cableworks.agent</strong> · 6 seconds ago</div>
          <div style={{ height: 18 }} />
          <HPriceLadder target={4.00} max={5.00} current={4.75} />
        </HCard>

        <HCard style={confirmed ? { background: H.successBg, borderColor: H.successBd } : { background: H.warnTint, borderColor: H.warnBd }}>
          <HEyebrow>{confirmed ? "Settled" : "Awaiting your confirmation"}</HEyebrow>
          {confirmed ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>Paid 4.75 USDC to cableworks.agent</div>
              <div style={{ color: H.fg2, fontSize: 13, marginTop: 4 }}>x402 settlement signed · audit entry written</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <HPill tone="green">✓ settled</HPill>
                <HPill>tx 0x9f…2c1e</HPill>
                <HPill>artifact tracking #USPS-9402</HPill>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, color: H.fg, marginTop: 8, lineHeight: 1.5 }}>
                Your agent settled at <strong>4.75 USDC</strong> — under your $5.00 cap. Your shim has approved this. <br />Confirm to release payment via x402.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <HButton kind="primary" onClick={onConfirm}>Confirm & pay</HButton>
                <HButton kind="ghost">Counter manually</HButton>
                <HButton kind="danger">Walk away</HButton>
              </div>
            </>
          )}
        </HCard>
      </div>

      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.01em" }}>Transcript</h2>
        <HCard padding={0}>
          {[
            { who: "your agent", side: "buyer", t: "11:42:01", text: "opened nuff.negotiate at 4.00 USDC", method: "negotiate.open" },
            { who: "cableworks.agent", side: "seller", t: "11:42:01", text: "countered 5.50 USDC", method: "negotiate.counter" },
            { who: "your agent", side: "buyer", t: "11:42:02", text: "countered 4.40 USDC (split target/cap)", method: "negotiate.counter" },
            { who: "cableworks.agent", side: "seller", t: "11:42:02", text: "countered 4.75 USDC", method: "negotiate.counter" },
            { who: "validation_shim", side: "shim", t: "11:42:02", text: "4.75 ≤ 5.00 cap · allow", method: "shim.allow" },
            { who: "your agent", side: "buyer", t: "11:42:03", text: "ready to accept · awaiting human confirm", method: "telegram.notify" },
          ].map((e, i, arr) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 200px", gap: 14, padding: "12px 18px", borderBottom: i < arr.length - 1 ? `1px solid ${H.border}` : "none", alignItems: "center", fontSize: 13 }}>
              <span style={{ fontFamily: H.mono, color: H.fg4, fontSize: 11 }}>{e.t}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {e.side !== "shim" && <AgentGlyph seed={e.who} size={20} />}
                {e.side === "shim" && <span style={{ color: H.accentMid, fontFamily: H.mono, width: 20, textAlign: "center" }}>◇</span>}
                <span><strong style={{ fontWeight: 500 }}>{e.who}</strong> <span style={{ color: H.fg2 }}>{e.text}</span></span>
              </div>
              <span style={{ fontFamily: H.mono, color: H.fg3, fontSize: 11, textAlign: "right" }}>{e.method}</span>
            </div>
          ))}
        </HCard>
      </div>
    </div>
  );
}

// ─── Spending policies ────────────────────────────────────────────────
function HPoliciesScreen() {
  const policies = [
    { name: "Office supplies", cap: "$100 / mo", rules: ["max ≤ $20 per item", "max 3 rounds", "categories: cables, paper, ink"], used: "$12.40", pct: 12.4 },
    { name: "Cloud compute", cap: "$500 / mo", rules: ["max ≤ $80 per session", "require x402 settlement", "trusted: compute-mesh, lambda-relay"], used: "$340.00", pct: 68 },
    { name: "Travel & tickets", cap: "$200 / mo", rules: ["always require human confirm", "max 2 rounds", "only between 06:00–22:00 PT"], used: "$0.00", pct: 0 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1080 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Spending policies</h1>
        <div style={{ color: H.fg3, fontSize: 13, marginTop: 8 }}>Your shim enforces these locally before any outbound RPC. <strong style={{ color: H.fg }}>Tactics, not authority.</strong></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {policies.map((p) => (
          <HCard key={p.name}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
              <div style={{ flex: 1 }} />
              <div style={{ color: H.fg3, fontSize: 12, fontFamily: H.mono }}>{p.cap}</div>
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {p.rules.map((r) => (
                <div key={r} style={{ display: "flex", gap: 10, fontSize: 13, color: H.fg2 }}>
                  <span style={{ color: H.accentMid }}>·</span><span>{r}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 16 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 4, background: H.bg3, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${p.pct}%`, height: "100%", background: p.pct > 80 ? H.warn : H.accentMid }} />
              </div>
              <span style={{ fontFamily: H.mono, fontSize: 12, color: H.fg2 }}>{p.used}</span>
            </div>
          </HCard>
        ))}
        <HCard style={{ display: "flex", alignItems: "center", justifyContent: "center", borderStyle: "dashed", color: H.fg3, fontSize: 13, cursor: "pointer", minHeight: 200 }}>+ New policy</HCard>
      </div>
    </div>
  );
}

// ─── Audit log ────────────────────────────────────────────────────────
function HAuditScreen() {
  const rows = [
    { t: "11:42:03", level: "ok",   text: "deal_a93kf2 · settled · 4.75 USDC · cableworks.agent" },
    { t: "11:42:02", level: "ok",   text: "shim.allow · 4.75 ≤ cap 5.00 · deal_a93kf2" },
    { t: "11:38:12", level: "warn", text: "shim.block · 7.00 > cap 5.00 · accepted_price_exceeds_max_price · compute-mesh" },
    { t: "11:31:45", level: "ok",   text: "policy.update · 'Cloud compute' max raised $60 → $80 · by Tessa" },
    { t: "10:18:09", level: "info", text: "agent.signed_in · tessa.agent · base-sepolia" },
    { t: "09:44:02", level: "ok",   text: "deal_84jk3d · settled · 32.00 USDC · deskwarehouse" },
    { t: "09:12:55", level: "warn", text: "negotiation.walked · tixrelay · max_rounds_exceeded" },
  ];
  const tone = (l) => l === "warn" ? H.warn : l === "ok" ? H.success : H.fg3;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1080 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Audit log</h1>
        <div style={{ color: H.fg3, fontSize: 13, marginTop: 8 }}>Every action your agent took, in your own words. Append-only.</div>
      </div>
      <HCard padding={0}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "92px 14px 1fr",
            gap: 14, padding: "11px 18px", fontSize: 13, alignItems: "center",
            borderBottom: i < rows.length - 1 ? `1px solid ${H.border}` : "none",
            background: r.level === "warn" ? H.warnTint : "transparent",
          }}>
            <span style={{ fontFamily: H.mono, color: H.fg4, fontSize: 11 }}>{r.t}</span>
            <span style={{ color: tone(r.level), fontFamily: H.mono }}>{r.level === "warn" ? "⊘" : r.level === "ok" ? "✓" : "·"}</span>
            <span style={{ color: H.fg2, fontFamily: H.mono, fontSize: 12 }}>{r.text}</span>
          </div>
        ))}
      </HCard>
    </div>
  );
}

// ─── New-intent modal ─────────────────────────────────────────────────
function HNewIntentModal({ onClose, onSubmit }) {
  const [item, setItem] = useState("USB-C cable, 1m");
  const [target, setTarget] = useState("4.00");
  const [max, setMax] = useState("5.00");
  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(27,27,24,0.32)",
      display: "grid", placeItems: "center", zIndex: 50, fontFamily: H.font,
    }} onClick={onClose}>
      <div style={{ background: H.surf, border: `1px solid ${H.border}`, borderRadius: 12, width: 440, padding: 24, boxShadow: "0 18px 48px rgba(27,27,24,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>New intent</h2>
        <div style={{ color: H.fg3, fontSize: 13, marginTop: 4 }}>Tell your agent what to buy and the policy it must obey.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
          <Field label="Item" value={item} onChange={setItem} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Target price (USDC)" value={target} onChange={setTarget} mono />
            <Field label="Max price (USDC) · cap" value={max} onChange={setMax} mono accent={H.warn} />
          </div>
          <div style={{ background: H.bg2, border: `1px solid ${H.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: H.fg2 }}>
            Your shim will enforce <strong style={{ color: H.fg }}>cap = {max} USDC</strong> on every outbound RPC. The agent may negotiate down — never up.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 22, justifyContent: "flex-end" }}>
          <HButton kind="ghost" onClick={onClose}>Cancel</HButton>
          <HButton kind="primary" onClick={() => onSubmit({ item, target, max })}>Send to agent</HButton>
        </div>
      </div>
    </div>
  );
}
function Field({ label, value, onChange, mono, accent }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: H.fg3, fontWeight: 500 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{
        padding: "8px 10px", border: `1px solid ${H.borderStrong}`, borderRadius: 6,
        fontFamily: mono ? H.mono : H.font, fontSize: 13, color: accent || H.fg, background: H.surf, outline: "none",
      }} />
    </label>
  );
}

Object.assign(window, { HDealsHome, HLiveDealCard, HDealDetail, HPoliciesScreen, HAuditScreen, HNewIntentModal });
