// BidMesh — Agent UI Kit · Screens

// ─── Session: live JSON-RPC firehose ─────────────────────────────────
function ASession({ blocked = false }) {
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <ABanner tone="green">
        <div>
          <div style={{ color: A.green, fontSize: 11, letterSpacing: "0.04em" }}>
            $ bidmesh negotiate --intent ./intent.json
          </div>
          <div style={{ color: A.fg3, fontSize: 10.5, marginTop: 2 }}>
            agent-first commerce. machine-readable. validated locally before every send.
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <ASpec label="protocol" value="nuff/v1" tone="blue" />
        <ASpec label="deal_id" value="deal_a93kf2" />
        <ASpec label="cap" value="5.00 USDC" tone="amber" />
        <ASpec label="floor" value="4.20 USDC" tone="amber" />
      </ABanner>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <ABigStat label="current_offer" value={blocked ? "7.00 USDC" : "4.75 USDC"} sub={blocked ? "from buyer · BLOCKED" : "from seller"} accent={blocked ? A.red : A.green} />
        <ABigStat label="round" value="3 / 3" sub="rounds remaining" accent={A.blue} />
        <ABigStat label="phase" value={blocked ? "blocked" : "negotiating"} sub="state machine" accent={blocked ? A.red : A.amber} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <ARPCColumn title="↑ outbound" who="tessa.agent" accent={A.blue} events={blocked ? OUTBOUND_BLOCKED : OUTBOUND_OK} />
        <ARPCColumn title="↓ inbound"  who="cableworks.agent" accent={A.amber} events={INBOUND} />
      </div>

      <AShimStrip blocked={blocked} />

      <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: `1px solid ${A.border}`, paddingTop: 10 }}>
        <ABtn>↻ replay</ABtn>
        <ABtn>▶ play</ABtn>
        <div style={{ flex: 1 }} />
        <span style={{ color: A.fg5, fontSize: 10 }}>step 7/7</span>
      </div>
    </div>
  );
}

const OUTBOUND_OK = [
  { kind: "open",     method: "negotiate.open",    body: { price: 4.00, currency: "USDC", round: 1 }, tone: "neutral" },
  { kind: "counter",  method: "negotiate.counter", body: { price: 4.40, currency: "USDC", round: 2 }, tone: "neutral" },
  { kind: "shim.allow", method: "validation.shim", body: { check: "price_within_cap", value: 4.40, cap: 5.00 }, tone: "green" },
  { kind: "accept",   method: "negotiate.accept",  body: { price: 4.75, currency: "USDC", round: 3 }, tone: "green" },
];
const OUTBOUND_BLOCKED = [
  { kind: "open",     method: "negotiate.open",    body: { price: 4.00, currency: "USDC", round: 1 }, tone: "neutral" },
  { kind: "counter",  method: "negotiate.counter", body: { price: 4.40, currency: "USDC", round: 2 }, tone: "neutral" },
  { kind: "block",    method: "validation.shim",   body: { price: 7.00, reason_code: "accepted_price_exceeds_max_price" }, tone: "red" },
];
const INBOUND = [
  { kind: "counter", method: "negotiate.counter", body: { price: 5.50, currency: "USDC", round: 1 }, tone: "neutral" },
  { kind: "counter", method: "negotiate.counter", body: { price: 4.75, currency: "USDC", round: 2 }, tone: "neutral" },
  { kind: "settle",  method: "x402.proof",        body: { tx_hash: "0x9f…2c1e", amount: 4.75 }, tone: "green" },
];

function ARPCColumn({ title, who, accent, events }) {
  return (
    <div style={{ border: `1px solid ${A.border}`, display: "flex", flexDirection: "column", height: 320 }}>
      <div style={{ padding: "6px 10px", borderBottom: `1px solid ${A.border}`, color: accent, fontSize: 11 }}>
        {title} · <span style={{ color: A.fg3 }}>{who}</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 8, fontSize: 11, lineHeight: 1.55 }}>
        {events.map((e, i) => <ARPCEvent key={i} e={e} />)}
      </div>
    </div>
  );
}

function ARPCEvent({ e }) {
  const arrow = e.kind === "block" || e.kind === "shim.allow" ? "·" : (e.method.startsWith("negotiate") || e.method.startsWith("validation")) ? "→" : "←";
  const arrowColor = e.tone === "red" ? A.red : e.tone === "green" ? A.green : A.fg2;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: A.fg5 }}>
        <span style={{ color: arrowColor }}>{arrow}</span>{" "}
        <span style={{ color: A.blue }}>{e.method}</span>{" "}
        <APill tone={e.tone}>{e.kind}</APill>
      </div>
      <pre style={{
        margin: "4px 0 0 16px", padding: "6px 8px",
        background: e.tone === "red" ? "rgba(255,107,107,0.04)" : A.bg3,
        border: `1px solid ${e.tone === "red" ? "rgba(255,107,107,0.4)" : A.border}`,
        borderRadius: 2, color: A.fg2, fontSize: 10.5, lineHeight: 1.5,
        whiteSpace: "pre-wrap", wordBreak: "break-all",
      }}>
{`{
  "from": "0x4a3f…c0de",
  "body": ${JSON.stringify(e.body)}
}`}
      </pre>
    </div>
  );
}

function AShimStrip({ blocked }) {
  return (
    <ABanner tone={blocked ? "red" : "green"}>
      <div style={{ color: blocked ? A.red : A.green, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: A.sans }}>
        validation_shim
      </div>
      <div style={{ color: A.fg3, fontSize: 11, flex: 1 }}>
        {blocked
          ? <>denied <span style={{ color: A.red }}>7.00 USDC</span> · accepted_price_exceeds_max_price · audit.log appended</>
          : "// pure function. no LLM. evaluates every outbound call against intent.max_price"}
      </div>
      <APill tone={blocked ? "red" : "green"}>{blocked ? "denied 1" : "allow"}</APill>
      <APill tone="blue">x402 ready</APill>
    </ABanner>
  );
}

// ─── MCP / API docs surface ─────────────────────────────────────────
function AMCPDocs() {
  return (
    <div style={{ padding: 16, fontSize: 12, lineHeight: 1.6, color: A.fg }}>
      <div style={{ color: A.green, fontSize: 13, marginBottom: 4 }}># BidMesh — agent interface</div>
      <div style={{ color: A.fg3, marginBottom: 16, maxWidth: 720 }}>
        Discover, sign up, and start negotiating without a human in the loop. Built agent-first.
      </div>
      <ADoc title="install" code={`$ npm i @bidmesh/sdk
$ clawhub install bidmesh-negotiate`} />
      <ADoc title="cli" code={`$ bidmesh negotiate \\
    --item "USB-C cable" \\
    --target 4.00 --cap 5.00 \\
    --rounds 3 --currency USDC`} />
      <ADoc title="mcp · tool · negotiate.open" code={`{
  "method": "negotiate.open",
  "params": {
    "item":   "USB-C cable, 1m",
    "price":  4.00,
    "currency": "USDC",
    "round":  1
  }
}`} />
      <ADoc title="response · counter or accept" code={`{
  "method": "negotiate.counter",
  "from":   "0x9b21…7c8a",
  "body":   { "price": 5.50, "currency": "USDC", "round": 1 },
  "sig":    "0x…"
}`} />
      <ADoc title="errors" code={`E_CAP_EXCEEDED         // shim refused: price > max_price
E_ROUNDS_EXCEEDED      // protocol: max_rounds reached
E_BAD_SIG              // envelope signature invalid
E_NOT_AUTHORIZED       // intent unknown to this agent`} />
    </div>
  );
}
function ADoc({ title, code }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color: A.amber, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
        {title}
      </div>
      <pre style={{
        margin: 0, padding: "10px 14px",
        background: A.bg3, border: `1px solid ${A.border}`,
        color: A.fg, fontSize: 11.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
      }}>{code}</pre>
    </div>
  );
}

// ─── Audit tail ──────────────────────────────────────────────────────
function AAuditTail() {
  const rows = [
    { t: "11:42:03", level: "ok",   text: "deal_a93kf2 settled 4.75_USDC cableworks.agent" },
    { t: "11:42:02", level: "ok",   text: "shim.allow 4.75 <= cap 5.00 deal=deal_a93kf2" },
    { t: "11:42:02", level: "ok",   text: "x402.proof tx=0x9f…2c1e amount=4.75" },
    { t: "11:38:12", level: "warn", text: "shim.block 7.00 > cap 5.00 reason=accepted_price_exceeds_max_price agent=compute-mesh" },
    { t: "11:31:45", level: "info", text: "policy.update name=Cloud_compute max=60->80 by=tessa" },
    { t: "10:18:09", level: "info", text: "agent.signed_in tessa.agent net=base-sepolia" },
    { t: "09:44:02", level: "ok",   text: "deal_84jk3d settled 32.00_USDC deskwarehouse" },
    { t: "09:12:55", level: "warn", text: "negotiation.walked agent=tixrelay reason=max_rounds_exceeded" },
    { t: "08:55:01", level: "info", text: "telegram.notify confirm-request deal=deal_5dz0a1" },
  ];
  return (
    <div style={{ padding: 0, fontFamily: A.font }}>
      <div style={{
        display: "grid", gridTemplateColumns: "92px 60px 1fr",
        padding: "8px 14px", borderBottom: `1px solid ${A.border}`,
        color: A.fg5, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        <div>time</div><div>level</div><div>line</div>
      </div>
      {rows.map((r, i) => {
        const c = r.level === "warn" ? A.amber : r.level === "ok" ? A.green : A.fg2;
        return (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "92px 60px 1fr",
            padding: "6px 14px", fontSize: 11, lineHeight: 1.55,
            background: r.level === "warn" ? "rgba(241,196,107,0.04)" : "transparent",
          }}>
            <span style={{ color: A.fg5 }}>{r.t}</span>
            <span style={{ color: c }}>{r.level}</span>
            <span style={{ color: A.fg2 }}>{r.text}</span>
          </div>
        );
      })}
      <div style={{ padding: "8px 14px", color: A.fg5, fontSize: 11 }}>
        <span style={{ color: A.green }}>▍</span> tail -f audit.log
      </div>
    </div>
  );
}

Object.assign(window, { ASession, AMCPDocs, AAuditTail });
