// BidMesh — Human UI Kit · Shell (sidebar, topbar, layout)

function HSidebar({ tab, setTab, compact = false }) {
  const items = [
    { id: "deals", label: "Deals", icon: "◇" },
    { id: "deal", label: "Live deal", icon: "●", badge: "1" },
    { id: "policies", label: "Spending policies", icon: "◈" },
    { id: "audit", label: "Audit log", icon: "◉" },
  ];
  const sec = { fontSize: 11, color: H.fg4, padding: "8px 10px 4px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 };
  const navItem = (active) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "6px 10px", borderRadius: 6,
    color: active ? H.fg : H.fg2,
    background: active ? H.border : "transparent",
    fontWeight: active ? 500 : 400, cursor: "pointer", fontSize: 13.5,
  });

  return (
    <div style={{
      background: H.bg2, borderRight: `1px solid ${H.border}`,
      padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4, overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px 14px" }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: `linear-gradient(135deg, ${H.accent}, ${H.accentSoft})`,
          display: "grid", placeItems: "center",
          color: H.bg, fontWeight: 600, fontSize: 13, fontFamily: H.mono,
        }}>B</div>
        <div style={{ display: compact ? "none" : "block" }}>
          <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>BidMesh</div>
          <div style={{ fontSize: 11, color: H.fg3 }}>tessa's agent</div>
        </div>
      </div>

      {!compact && <div style={sec}>Workspace</div>}
      {items.map((it) => (
        <div key={it.id} style={navItem(tab === it.id)} onClick={() => setTab(it.id)}>
          <span style={{ width: 14, color: H.fg4, fontSize: 11 }}>{it.icon}</span>
          {!compact && <span style={{ flex: 1 }}>{it.label}</span>}
          {it.badge && (
            <span style={{
              display: compact ? "none" : "inline-flex",
              fontSize: 10, padding: "1px 6px", borderRadius: 999,
              background: H.accent, color: H.bg, fontWeight: 600,
            }}>{it.badge}</span>
          )}
        </div>
      ))}

      {!compact && <div style={sec}>Discover</div>}
      {[{ id: "marketplace", label: "Marketplace", icon: "▤" }, { id: "agents", label: "Trusted agents", icon: "◐" }].map((it) => (
        <div key={it.id} style={navItem(false)}>
          <span style={{ width: 14, color: H.fg4, fontSize: 11 }}>{it.icon}</span>
          {!compact && <span style={{ flex: 1 }}>{it.label}</span>}
        </div>
      ))}

      <div style={{ flex: 1 }} />
      <div style={{
        display: compact ? "none" : "block",
        background: H.warnTint, border: `1px solid ${H.warnBd}`, borderRadius: 8,
        padding: 12,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Spend cap this month</div>
        <div style={{ fontSize: 12, color: H.fg3, marginBottom: 10 }}>$12.40 of $100.00 used</div>
        <div style={{ height: 4, background: H.warnBd, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: "12.4%", height: "100%", background: H.warn }} />
        </div>
      </div>
    </div>
  );
}

function HTopbar({ crumb = "Workspace · Deals", onNewIntent, compact = false }) {
  return (
    <div style={{
      height: 52, borderBottom: `1px solid ${H.border}`,
      display: "flex", alignItems: "center", padding: "0 28px", gap: 16,
      background: H.bg, flexShrink: 0,
    }}>
      <div style={{ color: H.fg3, fontSize: 13 }}>{crumb}</div>
      <div style={{ flex: 1 }} />
      <div style={{
        display: compact ? "none" : "flex", alignItems: "center", gap: 8,
        background: H.bg2, border: `1px solid ${H.border}`,
        borderRadius: 7, padding: "5px 10px", color: H.fg3, fontSize: 13, minWidth: 280,
      }}>
        <span>⌕</span>
        <span style={{ flex: 1 }}>Search deals, agents, policies…</span>
        <HKbd>⌘K</HKbd>
      </div>
      {!compact && <HButton kind="ghost">Invite agent</HButton>}
      <HButton kind="primary" onClick={onNewIntent}>+ New intent</HButton>
    </div>
  );
}

function HShell({ tab, setTab, crumb, children, onNewIntent }) {
  const compact = typeof window !== "undefined" && window.innerWidth < 1100;
  return (
    <div style={{
      fontFamily: H.font, background: H.bg, color: H.fg,
      height: "100%", display: "grid", gridTemplateColumns: compact ? "88px 1fr" : "232px 1fr",
      fontSize: 14, letterSpacing: "-0.005em", overflow: "hidden",
    }}>
      <HSidebar tab={tab} setTab={setTab} compact={compact} />
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <HTopbar crumb={crumb} onNewIntent={onNewIntent} compact={compact} />
        <div style={{ flex: 1, overflow: "auto", padding: compact ? "20px 20px 56px" : "32px 40px 80px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HSidebar, HTopbar, HShell });
