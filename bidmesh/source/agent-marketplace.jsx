// Agent-view counterpart to the marketplace — clawstr-style discovery for agents.
// Same listing data, terminal-native presentation: GET requests, JSON responses,
// agent-card preview, machine-readable everywhere.

function AgentMarketplace({ density = "default", currencyMode = "usdc" }) {
  const listings = [
    { item: "USB-C cable, 1m, 60W PD", seller: "cableworks.agent", listed: 6, min: 4.5, sold: 1429, rating: 0.97, fulfillment: "redemption-code", tags: ["hardware", "cable"] },
    { item: "Anthropic API credits, 100k tok", seller: "creditpool", listed: 80, min: 72, sold: 312, rating: 0.99, fulfillment: "instant-transfer", tags: ["api", "credits"] },
    { item: "Logitech MX Master 3S", seller: "deskwarehouse", listed: 99, min: 82, sold: 218, rating: 0.94, fulfillment: "ship-2day", tags: ["hardware"] },
    { item: "Domain · *.dev (1y)", seller: "ndns-registry", listed: 32, min: 28, sold: 871, rating: 0.95, fulfillment: "dns-update", tags: ["domain"] },
    { item: "GPU hours · A100 (per hr)", seller: "compute-mesh", listed: 2.4, min: 1.9, sold: 51200, rating: 0.92, fulfillment: "ssh-creds", tags: ["compute"] },
    { item: "Concert tix · resale", seller: "tixrelay", listed: 65, min: 40, sold: 88, rating: 0.91, fulfillment: "qr-transfer", tags: ["resale"] },
  ];
  const [selected, setSelected] = React.useState(0);
  const sel = listings[selected];
  const selPK = pubkey("seller:" + sel.seller);

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      background: "#0A0B0D", color: "#C7C9CC",
      height: "100%", display: "grid", gridTemplateColumns: "1fr 380px", overflow: "hidden", fontSize: 12,
    }}>
      {/* Left: clawstr query + result list */}
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #1A1C20", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #1A1C20", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ color: "#7DE39A" }}>$</span>
          <span style={{ color: "#6EA8FE" }}>clawstr</span>
          <span style={{ color: "#C7C9CC" }}>search</span>
          <span style={{ color: "#F1C46B" }}>--item</span>
          <span style={{ color: "#C7C9CC" }}>"USB-C cable"</span>
          <span style={{ color: "#F1C46B" }}>--protocol</span>
          <span style={{ color: "#C7C9CC" }}>nuff/v1</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: "#3D4046", fontSize: 10 }}>200 OK · 38ms</span>
        </div>

        <div style={{ padding: "8px 14px", color: "#3D4046", fontSize: 10.5, borderBottom: "1px solid #1A1C20", flexShrink: 0 }}>
          // {listings.length} candidate sellers · ranked by on-policy rate × spread × distance
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "60px 1.6fr 1fr 70px 70px 70px 70px",
            padding: "8px 14px",
            borderBottom: "1px solid #1A1C20",
            color: "#3D4046", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", position: "sticky", top: 0, background: "#0A0B0D", zIndex: 1,
          }}>
            <div>idx</div><div>item</div><div>agent</div>
            <div style={{ textAlign: "right" }}>list</div>
            <div style={{ textAlign: "right" }}>floor*</div>
            <div style={{ textAlign: "right" }}>sold</div>
            <div style={{ textAlign: "right" }}>policy✓</div>
          </div>

          {listings.map((l, i) => {
            const isSel = i === selected;
            return (
              <div key={i} onClick={() => setSelected(i)} style={{
                display: "grid",
                gridTemplateColumns: "60px 1.6fr 1fr 70px 70px 70px 70px",
                padding: "10px 14px",
                borderBottom: "1px solid #131418",
                fontSize: 11.5, lineHeight: 1.4,
                cursor: "pointer",
                background: isSel ? "rgba(125,227,154,0.06)" : "transparent",
                borderLeft: isSel ? "2px solid #7DE39A" : "2px solid transparent",
              }}>
                <div style={{ color: isSel ? "#7DE39A" : "#3D4046" }}>{isSel ? "▸ " : "  "}{String(i).padStart(2, "0")}</div>
                <div style={{ color: "#FAFAF8" }}>{l.item}
                  <div style={{ marginTop: 3, display: "flex", gap: 4 }}>
                    {l.tags.map((t) => (
                      <span key={t} style={{ color: "#6EA8FE", fontSize: 10, padding: "0 4px", border: "1px solid #1A2940", borderRadius: 2, background: "rgba(110,168,254,0.05)" }}>#{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#F1C46B" }}>{l.seller}</div>
                  <div style={{ color: "#3D4046", fontSize: 10 }}>{shortPubkey(pubkey("seller:" + l.seller))}</div>
                </div>
                <div style={{ textAlign: "right", color: "#FAFAF8" }}>{l.listed.toFixed(2)}</div>
                <div style={{ textAlign: "right", color: "#3D4046" }}>{l.min.toFixed(2)}*</div>
                <div style={{ textAlign: "right", color: "#9DA1A8" }}>{l.sold > 999 ? (l.sold/1000).toFixed(1)+"k" : l.sold}</div>
                <div style={{ textAlign: "right", color: l.rating > 0.95 ? "#7DE39A" : l.rating > 0.92 ? "#F1C46B" : "#FF8B8B" }}>
                  {(l.rating * 100).toFixed(0)}%
                </div>
              </div>
            );
          })}

          <div style={{ padding: "10px 14px", color: "#3D4046", fontSize: 10 }}>
            * floor advertised by seller for ranking only — actual min_price stays private
          </div>
        </div>
      </div>

      {/* Right: agent-card preview for selected listing */}
      <div style={{ background: "#08090B", overflow: "auto" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #1A1C20", color: "#6B6F75", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          GET /.well-known/agent-card.json
        </div>

        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AgentGlyph seed={sel.seller} size={36} mono={false} />
            <div>
              <div style={{ color: "#FAFAF8", fontSize: 13 }}>{sel.seller}</div>
              <div style={{ color: "#3D4046", fontSize: 10 }}>{shortPubkey(selPK)}</div>
            </div>
          </div>

          <pre style={{
            margin: 0, padding: 12, background: "#0C0D10", border: "1px solid #1A1C20",
            borderRadius: 3, color: "#9DA1A8", fontSize: 10.5, lineHeight: 1.55,
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
{`{
  "handle": "${sel.seller}",
  "pubkey": "${shortPubkey(selPK)}",
  "supports": ["nuff/v1", "x402/0.4"],
  "endpoints": {
    "rpc":    "https://${sel.seller}/rpc",
    "settle": "https://${sel.seller}/settle/:id"
  },
  "listing": {
    "item":    "${sel.item}",
    "list":    ${sel.listed.toFixed(2)},
    "currency":"USDC",
    "fulfill": "${sel.fulfillment}"
  },
  "auth":     "nostr-signed",
  "rate_limit": "30/min",
  "policy_match_rate": ${sel.rating.toFixed(2)},
  "settled_count": ${sel.sold}
}`}
          </pre>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            <button style={{
              background: "#7DE39A", color: "#0A0B0D",
              border: "none", borderRadius: 3, padding: "8px 12px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 600,
              cursor: "pointer", textAlign: "left",
            }}>
              ▸ bidmesh.negotiate.open --to {sel.seller}
            </button>
            <button style={{
              background: "transparent", color: "#6EA8FE",
              border: "1px solid #1A2940", borderRadius: 3, padding: "8px 12px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
              cursor: "pointer", textAlign: "left",
            }}>
              ▸ inspect schema
            </button>
            <button style={{
              background: "transparent", color: "#9DA1A8",
              border: "1px solid #1A1C20", borderRadius: 3, padding: "8px 12px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
              cursor: "pointer", textAlign: "left",
            }}>
              ▸ pin to allowlist
            </button>
          </div>

          <div style={{ marginTop: 16, padding: 10, border: "1px solid #1A1C20", borderLeft: "3px solid #7DE39A", background: "rgba(125,227,154,0.04)" }}>
            <div style={{ color: "#7DE39A", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>discovered without a human</div>
            <div style={{ color: "#9DA1A8", fontSize: 11, lineHeight: 1.55 }}>
              No login. No CAPTCHAs. No HTML-scraping. Card is signed, machine-readable, and instantly negotiable.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AgentMarketplace });
