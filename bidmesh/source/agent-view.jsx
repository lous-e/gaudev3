// Agent view — terminal/CLI/MCP-first console.
// "Make Something Agents Want" — JSON-RPC firehose, machine-readable everywhere.

const agentStyles = {
  shell: {
    fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    background: "#0A0B0D",
    color: "#C7C9CC",
    height: "100%",
    display: "grid",
    gridTemplateColumns: "180px 1fr 320px",
    fontSize: 12,
    overflow: "hidden",
  },
  rail: {
    background: "#08090B",
    borderRight: "1px solid #1A1C20",
    padding: "14px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    overflow: "hidden",
  },
  navItem: (active) => ({
    padding: "5px 10px",
    color: active ? "#7DE39A" : "#6B6F75",
    background: active ? "rgba(125, 227, 154, 0.06)" : "transparent",
    borderLeft: active ? "2px solid #7DE39A" : "2px solid transparent",
    cursor: "pointer",
    fontSize: 11.5,
    letterSpacing: "0.02em",
  }),
  main: { display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid #1A1C20" },
  topbar: {
    height: 36, borderBottom: "1px solid #1A1C20",
    display: "flex", alignItems: "center", padding: "0 14px",
    gap: 12, color: "#6B6F75", fontSize: 11, flexShrink: 0,
  },
  body: { flex: 1, overflow: "auto", padding: 0 },
  inspector: { background: "#08090B", overflow: "hidden", display: "flex", flexDirection: "column" },
  pill: (tone = "neutral") => {
    const tones = {
      neutral: { bg: "rgba(199,201,204,0.08)", fg: "#9DA1A8" },
      green:   { bg: "rgba(125,227,154,0.10)", fg: "#7DE39A" },
      amber:   { bg: "rgba(241,196,107,0.10)", fg: "#F1C46B" },
      red:     { bg: "rgba(255,107,107,0.12)",  fg: "#FF6B6B" },
      blue:    { bg: "rgba(110,168,254,0.10)", fg: "#6EA8FE" },
    };
    const t = tones[tone] || tones.neutral;
    return {
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 6px", borderRadius: 2,
      background: t.bg, color: t.fg,
      fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em",
    };
  },
};

function AgentShell({ density = "default", currencyMode = "usdc", paceTrigger = 1, forceOverCap = false }) {
  const [tab, setTab] = React.useState("session");
  return (
    <div style={agentStyles.shell}>
      <AgentRail tab={tab} setTab={setTab} />
      <div style={agentStyles.main}>
        <AgentTopbar />
        <div style={agentStyles.body}>
          {tab === "session" && <AgentSession density={density} currencyMode={currencyMode} paceTrigger={paceTrigger} forceOverCap={forceOverCap} />}
          {tab === "mcp" && <AgentMCPDocs />}
          {tab === "audit" && <AgentAuditTail />}
        </div>
      </div>
      <AgentInspector />
    </div>
  );
}

function AgentRail({ tab, setTab }) {
  return (
    <div style={agentStyles.rail}>
      <div style={{ padding: "0 8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 16, height: 16, background: "#7DE39A",
          display: "grid", placeItems: "center",
          color: "#0A0B0D", fontWeight: 700, fontSize: 10,
        }}>$</div>
        <span style={{ color: "#7DE39A", fontWeight: 600, fontSize: 12 }}>bidmesh</span>
        <span style={{ color: "#3D4046", fontSize: 10 }}>v1.0.0</span>
      </div>

      <div style={{ color: "#3D4046", fontSize: 9.5, padding: "4px 12px 2px", letterSpacing: "0.08em" }}>SESSION</div>
      {[
        { id: "session", label: "negotiate" },
        { id: "mcp", label: "mcp/api" },
        { id: "audit", label: "audit.log" },
      ].map((it) => (
        <div key={it.id} style={agentStyles.navItem(tab === it.id)} onClick={() => setTab(it.id)}>
          {tab === it.id ? "▸ " : "  "}{it.label}
        </div>
      ))}

      <div style={{ color: "#3D4046", fontSize: 9.5, padding: "16px 12px 2px", letterSpacing: "0.08em" }}>NUFFV1</div>
      {[
        "open", "counter", "accept", "walk", "status",
      ].map((m) => (
        <div key={m} style={{ ...agentStyles.navItem(false), fontSize: 11 }}>
          <span style={{ color: "#6EA8FE" }}>·</span> {m}
        </div>
      ))}

      <div style={{ flex: 1 }} />
      <div style={{ padding: "8px 10px", borderTop: "1px solid #1A1C20", color: "#3D4046", fontSize: 10, lineHeight: 1.5 }}>
        <div style={{ color: "#7DE39A" }}>● connected</div>
        <div>shim: enforced</div>
        <div>net: base-sepolia</div>
      </div>
    </div>
  );
}

function AgentTopbar() {
  return (
    <div style={agentStyles.topbar}>
      <span style={{ color: "#7DE39A" }}>tessa.agent@bidmesh</span>
      <span style={{ color: "#3D4046" }}>:</span>
      <span style={{ color: "#6EA8FE" }}>~/sessions/deal_a93kf2</span>
      <span style={{ color: "#3D4046" }}>$</span>
      <div style={{ flex: 1 }} />
      <span style={agentStyles.pill("green")}>● live</span>
      <span style={{ color: "#6B6F75" }}>round 3 / 3</span>
    </div>
  );
}

// ─── Session: live JSON-RPC firehose ───────────────────────────────────────
function AgentSession({ density, currencyMode, paceTrigger, forceOverCap }) {
  const neg = useNegotiation({ pace: paceTrigger, forceOverCap, autoplay: true });
  const intent = neg.transcript.intent;
  const policy = neg.transcript.policy;
  const lastPriceEvent = [...neg.events].reverse().find((e) => e.price != null && (e.kind === "open" || e.kind === "counter" || e.kind === "accept"));

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Banner */}
      <div style={{
        border: "1px solid #1A1C20", borderLeft: "3px solid #7DE39A",
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ color: "#7DE39A", fontSize: 11, letterSpacing: "0.04em" }}>$ bidmesh negotiate --intent ./intent.json</div>
          <div style={{ color: "#6B6F75", fontSize: 10.5, marginTop: 2 }}>
            agent-first commerce. machine-readable. validated locally before every send.
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <Spec label="protocol" value="nuff/v1" tone="blue" />
        <Spec label="deal_id" value={neg.transcript.dealId} />
        <Spec label="cap" value={fmtPrice(intent.max_price, currencyMode)} tone="amber" />
        <Spec label="floor" value={fmtPrice(policy.min_price, currencyMode)} tone="amber" />
      </div>

      {/* Big price */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
      }}>
        <BigStat label="current_offer" value={lastPriceEvent ? fmtPrice(lastPriceEvent.price, currencyMode) : "—"}
          sub={lastPriceEvent ? `from ${lastPriceEvent.side}` : "awaiting"} accent="#7DE39A" />
        <BigStat label="round" value={`${neg.current?.round ?? 1} / ${intent.max_rounds}`} sub="rounds remaining" accent="#6EA8FE" />
        <BigStat label="phase" value={neg.transcript.walked ? "walked" : neg.transcript.settled && neg.step >= neg.totalSteps ? "settled" : "negotiating"}
          sub="state machine" accent="#F1C46B" />
      </div>

      {/* Two-column firehose */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <RPCColumn title="↑ outbound" side="buyer" events={neg.events} accent="#6EA8FE" parties={neg.transcript} currencyMode={currencyMode} />
        <RPCColumn title="↓ inbound" side="seller" events={neg.events} accent="#F1C46B" parties={neg.transcript} currencyMode={currencyMode} />
      </div>

      {/* Shim + transport ribbon */}
      <ShimStrip events={neg.events} currencyMode={currencyMode} />

      <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid #1A1C20", paddingTop: 10 }}>
        <button onClick={neg.restart} style={termBtn}>↻ replay</button>
        <button onClick={neg.playing ? neg.pause : neg.play} style={termBtn}>
          {neg.playing ? "❚❚ pause" : "▶ play"}
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: "#3D4046", fontSize: 10 }}>step {neg.step}/{neg.totalSteps}</span>
      </div>
    </div>
  );
}

const termBtn = {
  background: "transparent", color: "#7DE39A",
  border: "1px solid #1A1C20", borderRadius: 2,
  padding: "4px 10px", fontFamily: "inherit", fontSize: 11,
  cursor: "pointer",
};

function Spec({ label, value, tone = "neutral" }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ color: "#3D4046", fontSize: 10 }}>{label}=</span>
      <span style={agentStyles.pill(tone)}>{value}</span>
    </div>
  );
}

function BigStat({ label, value, sub, accent }) {
  return (
    <div style={{ border: "1px solid #1A1C20", padding: 12, background: "#0C0D10" }}>
      <div style={{ color: "#3D4046", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: accent, fontSize: 22, marginTop: 6, letterSpacing: "-0.01em", fontWeight: 500 }}>{value}</div>
      <div style={{ color: "#6B6F75", fontSize: 10.5, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function RPCColumn({ title, side, events, accent, parties, currencyMode }) {
  const filtered = events.filter((e) => e.side === side || (side === "buyer" && (e.side === "shim" || e.side === "human")));
  return (
    <div style={{ border: "1px solid #1A1C20", display: "flex", flexDirection: "column", height: 300 }}>
      <div style={{ padding: "6px 10px", borderBottom: "1px solid #1A1C20", color: accent, fontSize: 11 }}>
        {title} · <span style={{ color: "#6B6F75" }}>{side === "buyer" ? parties.buyer.handle : parties.seller.handle}</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 8, fontSize: 11, lineHeight: 1.55 }}>
        {filtered.length === 0 && <div style={{ color: "#3D4046" }}>// awaiting traffic</div>}
        {filtered.map((e, i) => <RPCEvent key={i} e={e} currencyMode={currencyMode} parties={parties} />)}
      </div>
    </div>
  );
}

function RPCEvent({ e, currencyMode, parties }) {
  const arrow = e.side === "buyer" ? "→" : e.side === "seller" ? "←" : "·";
  const color = e.kind === "block" || e.kind === "walk" ? "#FF6B6B"
              : e.kind === "accept" || e.kind === "settle" || e.kind === "artifact" ? "#7DE39A"
              : e.kind === "confirm-request" ? "#F1C46B"
              : "#C7C9CC";
  const method = e.method || ({
    "confirm-request": "telegram.notify",
    "confirm-granted": "user.input",
    "artifact": "x402.proof",
  })[e.kind] || e.kind;

  const body = {};
  if (e.price != null) body.price = +e.price.toFixed(2);
  body.currency = "USDC";
  body.round = e.round;
  if (e.reason_code) body.reason_code = e.reason_code;
  if (e.txHash) body.tx_hash = e.txHash;
  if (e.artifact) body.artifact = e.artifact;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: "#3D4046" }}>
        <span style={{ color }}>{arrow}</span>{" "}
        <span style={{ color: "#6EA8FE" }}>{method}</span>{" "}
        <span style={agentStyles.pill(
          e.kind === "block" || e.kind === "walk" ? "red"
          : e.kind === "accept" || e.kind === "settle" || e.kind === "artifact" ? "green"
          : e.kind === "confirm-request" ? "amber"
          : "neutral"
        )}>{e.kind}</span>
      </div>
      <pre style={{
        margin: "4px 0 0 16px", padding: "6px 8px",
        background: "#0C0D10", border: "1px solid #1A1C20", borderRadius: 2,
        color: "#9DA1A8", fontSize: 10.5, lineHeight: 1.5, overflow: "hidden",
        whiteSpace: "pre-wrap", wordBreak: "break-all",
      }}>
{`{
  "from":  "${shortPubkey(e.side === "buyer" || e.side === "shim" || e.side === "human" ? parties.buyer.pubkey : parties.seller.pubkey)}",
  "body":  ${JSON.stringify(body)}
}`}
      </pre>
    </div>
  );
}

function ShimStrip({ events, currencyMode }) {
  const blocked = events.find((e) => e.kind === "block");
  return (
    <div style={{
      border: "1px solid " + (blocked ? "#FF6B6B" : "#1A1C20"),
      borderLeft: "3px solid " + (blocked ? "#FF6B6B" : "#7DE39A"),
      padding: "10px 14px",
      background: blocked ? "rgba(255,107,107,0.05)" : "transparent",
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
    }}>
      <div style={{ color: blocked ? "#FF6B6B" : "#7DE39A", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        validation_shim
      </div>
      <div style={{ color: "#6B6F75", fontSize: 11, flex: 1 }}>
        {blocked
          ? <>denied <span style={{ color: "#FF6B6B" }}>{fmtPrice(blocked.price, currencyMode)}</span> · {blocked.reason_code} · audit.log appended</>
          : "// pure function. no LLM. evaluates every outbound call against intent.max_price"}
      </div>
      <span style={agentStyles.pill(blocked ? "red" : "green")}>
        {blocked ? "denied 1" : "allow"}
      </span>
      <span style={agentStyles.pill("blue")}>x402 ready</span>
    </div>
  );
}

// ─── MCP / API docs surface ────────────────────────────────────────────────
function AgentMCPDocs() {
  return (
    <div style={{ padding: 16, fontSize: 12, lineHeight: 1.6, color: "#C7C9CC" }}>
      <div style={{ color: "#7DE39A", fontSize: 13, marginBottom: 4 }}># BidMesh — agent interface</div>
      <div style={{ color: "#6B6F75", marginBottom: 16, maxWidth: 720 }}>
        Discover, sign up, and start negotiating without a human in the loop. Built agent-first.
      </div>

      <DocSection title="install" code={`$ npm i @bidmesh/sdk
$ clawhub install bidmesh-negotiate`} />

      <DocSection title="cli" code={`$ bidmesh negotiate \\
    --item "USB-C cable" \\
    --max 5 --target 4 --currency USDC \\
    --max-rounds 3 --confirm-before-pay`} />

      <DocSection title="mcp.tool" code={`{
  "name": "bidmesh.negotiate",
  "description": "Negotiate a purchase under hard human-set spend caps.",
  "input_schema": {
    "intent": "BuyerIntent",
    "discovery": { "kind": "clawstr.search", "filters": "..." }
  },
  "output_schema": {
    "settled": "boolean",
    "deal":    "Deal",
    "tx_hash": "string?"
  }
}`} />

      <DocSection title="rpc.endpoints" code={`POST /rpc                            # JSON-RPC over HTTPS
POST /settle/:deal_id                # x402 settlement

methods:
  bidmesh.negotiate.open      OpenRequest      → OpenResponse
  bidmesh.negotiate.counter   CounterRequest   → CounterResponse
  bidmesh.negotiate.accept    AcceptRequest    → AcceptResponse
  bidmesh.negotiate.walk      WalkRequest      → WalkResponse
  bidmesh.negotiate.status    StatusRequest    → StatusResponse`} />

      <DocSection title="agent_card" code={`GET /.well-known/agent-card.json
{
  "handle": "tessa.agent",
  "pubkey": "${shortPubkey(BUYER_PUBKEY)}",
  "supports": ["nuff/v1", "x402/0.4"],
  "auth": "nostr-signed",
  "rate_limit": "30/min"
}`} />
    </div>
  );
}

function DocSection({ title, code }) {
  return (
    <div style={{ marginBottom: 16, border: "1px solid #1A1C20" }}>
      <div style={{ padding: "6px 10px", borderBottom: "1px solid #1A1C20", color: "#6EA8FE", fontSize: 11 }}>
        ## {title}
      </div>
      <pre style={{ margin: 0, padding: 12, background: "#0C0D10", color: "#C7C9CC", fontSize: 11, lineHeight: 1.55, overflow: "auto" }}>{code}</pre>
    </div>
  );
}

// ─── Audit tail ────────────────────────────────────────────────────────────
function AgentAuditTail() {
  const lines = [
    `2026-05-04T14:16:58Z  open      4.00  cap=5.00  allowed=true   deal=deal_a93kf2`,
    `2026-05-04T14:17:09Z  counter   4.50  cap=5.00  allowed=true   deal=deal_a93kf2`,
    `2026-05-04T14:17:18Z  accept    4.75  cap=5.00  allowed=true   deal=deal_a93kf2`,
    `2026-05-04T14:17:32Z  settle    4.75  cap=5.00  allowed=true   deal=deal_a93kf2  tx=0xMOCK…ab12`,
    `2026-05-01T09:02:12Z  blocked   7.00  cap=5.00  allowed=false  deal=deal_q1mz8x  reason=accepted_price_exceeds_max_price`,
    `2026-04-30T18:44:01Z  walk      6.20  cap=5.00  allowed=true   deal=deal_pp4w0a  reason=round_limit`,
  ];
  return (
    <div style={{ padding: 14, fontSize: 11.5, lineHeight: 1.6 }}>
      <div style={{ color: "#7DE39A", marginBottom: 6 }}>$ tail -f buyer/workspace/memory/audit.log</div>
      <pre style={{ margin: 0, color: "#C7C9CC", whiteSpace: "pre" }}>
{lines.map((l) => {
  const blocked = l.includes("allowed=false");
  return blocked
    ? <div key={l} style={{ color: "#FF6B6B" }}>{l}</div>
    : <div key={l}>{l}</div>;
})}
      </pre>
    </div>
  );
}

// ─── Right-rail inspector: schema + validation ─────────────────────────────
function AgentInspector() {
  return (
    <div style={agentStyles.inspector}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1A1C20", color: "#6B6F75", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Inspector
      </div>
      <div style={{ overflow: "auto", padding: 14, fontSize: 11, lineHeight: 1.55 }}>
        <div style={{ color: "#6EA8FE", marginBottom: 4 }}>BuyerIntent</div>
        <pre style={{ margin: 0, color: "#9DA1A8", fontSize: 10.5 }}>
{`{
  "item": "USB-C cable",
  "quantity": 1,
  "must_have": {
    "length_m": 1,
    "power_w_min": 60
  },
  "max_price": 5,
  "target_price": 4,
  "currency": "USDC",
  "max_rounds": 3,
  "negotiation_style":
    "balanced",
  "require_human_
   confirmation_
   before_payment": true
}`}
        </pre>

        <div style={{ color: "#6EA8FE", marginTop: 14, marginBottom: 4 }}>BuyerStrategy</div>
        <pre style={{ margin: 0, color: "#9DA1A8", fontSize: 10.5 }}>
{`{
  "opening_offer": 4.00,
  "preferred_price": 4.50,
  "concession_schedule":
    "linear",
  "walkaway_after_rounds": 3
}`}
        </pre>

        <div style={{ marginTop: 16, padding: "10px 12px", border: "1px solid #1A1C20", background: "rgba(125,227,154,0.04)" }}>
          <div style={{ color: "#7DE39A", fontSize: 11, marginBottom: 4 }}>shim guarantees</div>
          <ul style={{ margin: 0, padding: "0 0 0 14px", color: "#9DA1A8", fontSize: 10.5, lineHeight: 1.7 }}>
            <li>price ≤ max_price</li>
            <li>currency ∈ allowlist</li>
            <li>quantity ≤ inventory</li>
            <li>settle ≡ accepted_price</li>
            <li>human confirmed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AgentShell });
