// Marketplace discovery + Seller console (combined for brevity)

// ─── Marketplace discovery: agent cards + listings ─────────────────────────
const LISTINGS = [
  { item: "USB-C cable, 1m, 60W PD", seller: "cableworks.agent", listed: 6, min: 4.5, sold: 1429, rating: 0.97, fulfillment: "redemption code", currency: "USDC" },
  { item: "Anthropic API credits, 100k tok", seller: "creditpool", listed: 80, min: 72, sold: 312, rating: 0.99, fulfillment: "instant transfer", currency: "USDC" },
  { item: "Logitech MX Master 3S", seller: "deskwarehouse", listed: 99, min: 82, sold: 218, rating: 0.94, fulfillment: "ship 2-day", currency: "USDC" },
  { item: "Domain · *.dev (1y)", seller: "ndns-registry", listed: 32, min: 28, sold: 871, rating: 0.95, fulfillment: "DNS update", currency: "USDC" },
  { item: "GPU hours · A100 (per hr)", seller: "compute-mesh", listed: 2.4, min: 1.9, sold: 51200, rating: 0.92, fulfillment: "ssh credentials", currency: "USDC" },
  { item: "Concert tix · resale", seller: "tixrelay", listed: 65, min: 40, sold: 88, rating: 0.91, fulfillment: "QR + transfer", currency: "USDC" },
];

function MarketplaceView({ density = "default", currencyMode = "usdc" }) {
  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "#FAFAF8", color: "#1B1B18",
      height: "100%", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        padding: "20px 32px", borderBottom: "1px solid #E8E6DF",
        display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Marketplace</div>
          <div style={{ fontSize: 13, color: "#7A7872", marginTop: 2 }}>
            Where agents discover other agents. Browse listings, inspect agent cards, kick off a negotiation.
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 8, background: "#F4F3EF",
          border: "1px solid #E8E6DF", borderRadius: 7, padding: "6px 12px", color: "#7A7872", fontSize: 13, minWidth: 320,
        }}>
          <span>⌕</span>
          <span style={{ flex: 1 }}>clawstr://search · "USB-C cable" "60W"</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: "#FFF", padding: "1px 6px", borderRadius: 4, border: "1px solid #E0DED5" }}>⌘K</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {LISTINGS.map((l, i) => <ListingCard key={i} l={l} currencyMode={currencyMode} />)}
        </div>

        <div style={{ marginTop: 30, fontSize: 12, color: "#7A7872", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>GET /.well-known/agent-card.json</span>
          <span>·</span>
          <span>Every seller publishes a machine-readable card. No login. No CAPTCHAs.</span>
        </div>
      </div>
    </div>
  );
}

function ListingCard({ l, currencyMode }) {
  const sellerHandle = l.seller;
  const sellerPK = pubkey("seller:" + sellerHandle);
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E8E6DF", borderRadius: 10,
      padding: 18, display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <AgentGlyph seed={sellerHandle} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{l.item}</div>
          <div style={{ fontSize: 12, color: "#7A7872", marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
            <span>{sellerHandle}</span>
            <span style={{ color: "#C9C7BD" }}>·</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{shortPubkey(sellerPK)}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.01em" }}>
            {fmtPrice(l.listed, currencyMode)}
          </div>
          <div style={{ fontSize: 11, color: "#7A7872", fontFamily: "'JetBrains Mono', monospace" }}>
            min {fmtPrice(l.min, currencyMode)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip>fulfill · {l.fulfillment}</Chip>
        <Chip>{l.sold.toLocaleString()} sold</Chip>
        <Chip tone="green">★ {(l.rating * 100).toFixed(0)}% on-policy</Chip>
        <Chip>nuff/v1</Chip>
        <Chip>x402</Chip>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 4 }}>
        <button style={{
          background: "#1B1B18", color: "#FAFAF8",
          border: "none", borderRadius: 6, padding: "7px 13px", fontSize: 12.5, fontWeight: 500,
          cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}>
          Send my agent →
        </button>
        <button style={{
          background: "#FFF", color: "#1B1B18",
          border: "1px solid #E0DED5", borderRadius: 6, padding: "7px 13px", fontSize: 12.5, fontWeight: 500,
          cursor: "pointer", fontFamily: "'Inter', sans-serif",
        }}>
          Inspect card
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: "#7A7872", fontFamily: "'JetBrains Mono', monospace" }}>
          /rpc · /settle/:id
        </span>
      </div>
    </div>
  );
}

function Chip({ children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "#F4F3EF", fg: "#5C5A52", bd: "#E8E6DF" },
    green:   { bg: "#EAF2EA", fg: "#2F6B3A", bd: "#D5E5D6" },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 999,
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
      fontSize: 11, fontWeight: 500,
    }}>{children}</span>
  );
}

// ─── Seller console ────────────────────────────────────────────────────────
function SellerConsole({ density = "default", currencyMode = "usdc", paceTrigger = 1, forceOverCap = false }) {
  const neg = useNegotiation({ pace: paceTrigger, forceOverCap, autoplay: true });
  const policy = neg.transcript.policy;

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "#FAFAF8", color: "#1B1B18",
      height: "100%", display: "grid", gridTemplateColumns: "1fr 1.2fr", overflow: "hidden",
    }}>
      {/* Left: policy editor */}
      <div style={{ padding: "24px 28px", borderRight: "1px solid #E8E6DF", overflow: "auto" }}>
        <div style={{ fontSize: 11, color: "#7A7872", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>SELLER CONSOLE</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4 }}>USB-C cable, 1m, 60W PD</div>
        <div style={{ fontSize: 13, color: "#7A7872", marginTop: 4 }}>
          Your agent <strong>cableworks.agent</strong> sells this on your terms. Below are the only rules it can act on.
        </div>

        <div style={{ background: "#FFF", border: "1px solid #E8E6DF", borderRadius: 10, marginTop: 20, padding: 18 }}>
          <SellerField label="List price" value={fmtPrice(policy.list_price, currencyMode)} sub="opening ask" />
          <SellerField label="Floor (min_price)" value={fmtPrice(policy.min_price, currencyMode)} sub="shim blocks below this" tone="red" />
          <SellerField label="Inventory" value={policy.inventory_available + " in stock"} sub="reserves on accept" />
          <SellerField label="Currency" value="USDC · base-sepolia" />
          <SellerField label="Fulfillment" value={policy.fulfillment_terms} />
          <SellerField label="Style" value={policy.negotiation_style} sub="firm · balanced · eager" />
          <SellerField label="Max rounds" value={String(policy.max_rounds)} last />
        </div>

        <div style={{ marginTop: 18, padding: 14, border: "1px dashed #D5E5D6", borderRadius: 8, background: "#F8FBF8" }}>
          <div style={{ fontSize: 13, color: "#3A6B5A", fontWeight: 600, marginBottom: 4 }}>Seller validation shim</div>
          <div style={{ fontSize: 12, color: "#5C5A52", lineHeight: 1.55 }}>
            Pure function. Rejects accepts below floor, oversells, unsupported currencies — before any LLM tactic can ship a bad deal.
          </div>
        </div>
      </div>

      {/* Right: live deal feed */}
      <div style={{ padding: "24px 28px", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Live deals</div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "2px 8px", borderRadius: 999,
            background: "#EBF1EE", color: "#3A6B5A",
            fontSize: 11.5, fontWeight: 500,
          }}>● 1 active</span>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: "#7A7872" }}>last 24h</div>
        </div>

        {/* Active deal stream */}
        <div style={{
          background: "#FFF", border: "1px solid #E8E6DF", borderRadius: 10,
          marginTop: 14, padding: 18,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AgentGlyph seed={neg.transcript.buyer.handle} size={26} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{neg.transcript.buyer.handle}</div>
              <div style={{ fontSize: 11, color: "#7A7872", fontFamily: "'JetBrains Mono', monospace" }}>{shortPubkey(neg.transcript.buyer.pubkey)}</div>
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "#7A7872", fontFamily: "'JetBrains Mono', monospace" }}>{neg.transcript.dealId}</span>
          </div>

          <div style={{ marginTop: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7, color: "#5C5A52" }}>
            {neg.events.slice(-7).map((e, i) => (
              <div key={i} style={{
                color: e.kind === "block" || e.kind === "walk" ? "#9B2C2C"
                  : e.kind === "accept" || e.kind === "settle" || e.kind === "artifact" ? "#3A6B5A"
                  : "#5C5A52",
              }}>
                <span style={{ color: "#9B998E" }}>[r{e.round}]</span>{" "}
                {e.side === "buyer" ? "← buyer" : e.side === "seller" ? "→ you" : e.side === "shim" ? "· shim" : "· " + e.side}{" "}
                <strong style={{ color: "#1B1B18" }}>{e.kind}</strong>
                {e.price != null && <> · {fmtPrice(e.price, currencyMode)}</>}
                {e.reason_code && <> · {e.reason_code}</>}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid #F0EFEA" }}>
            <button onClick={neg.restart} style={{
              background: "#FFF", color: "#1B1B18", border: "1px solid #E0DED5",
              borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}>↻ replay</button>
            <button onClick={neg.playing ? neg.pause : neg.play} style={{
              background: "#FFF", color: "#1B1B18", border: "1px solid #E0DED5",
              borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}>{neg.playing ? "❚❚" : "▶"}</button>
          </div>
        </div>

        {/* Recent settled */}
        <div style={{
          background: "#FFF", border: "1px solid #E8E6DF", borderRadius: 10,
          marginTop: 14, padding: 0, overflow: "hidden",
        }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #E8E6DF", fontSize: 12, color: "#7A7872", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Today · settled
          </div>
          {[
            { buyer: "carlos.agent", final: 4.85, when: "23m ago" },
            { buyer: "minh.agent", final: 4.95, when: "1h ago" },
            { buyer: "ada.agent", final: 5.20, when: "3h ago" },
            { buyer: "ren.agent", final: 4.50, when: "4h ago", note: "at floor" },
          ].map((d, i, arr) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr",
              padding: "12px 16px",
              borderBottom: i === arr.length - 1 ? "none" : "1px solid #F0EFEA",
              alignItems: "center", fontSize: 13,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AgentGlyph seed={d.buyer} size={20} />
                <span>{d.buyer}</span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{fmtPrice(d.final, currencyMode)}</div>
              <div style={{ fontSize: 11.5, color: d.note ? "#8A6500" : "#7A7872" }}>{d.note || "above floor"}</div>
              <div style={{ textAlign: "right", color: "#7A7872", fontSize: 12 }}>{d.when}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SellerField({ label, value, sub, tone = "neutral", last }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "180px 1fr",
      padding: "12px 0", gap: 16,
      borderBottom: last ? "none" : "1px solid #F0EFEA",
      alignItems: "baseline",
    }}>
      <div style={{ fontSize: 13, color: "#5C5A52" }}>{label}</div>
      <div>
        <div style={{
          fontSize: 14, fontWeight: 500,
          fontFamily: tone === "red" ? "'JetBrains Mono', monospace" : "inherit",
          color: tone === "red" ? "#9B2C2C" : "#1B1B18",
        }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: "#7A7872", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

Object.assign(window, { MarketplaceView, SellerConsole });
