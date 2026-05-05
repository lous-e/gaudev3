const { useEffect, useMemo, useRef, useState } = React;
const AGENT_DEMO_EVENT_TYPES = [
  "marketplace.selected",
  "marketplace.scan_started",
  "marketplace.seller_reviewed",
  "marketplace.selection_finalized",
  "policy.created",
  "rpc.sent",
  "rpc.received",
  "validation.allowed",
  "validation.blocked",
  "human.confirmation_requested",
  "human.approved",
  "human.denied",
  "settlement.mocked",
  "deal.walked",
  "deal.settled",
];

function agentHydrateDeal(deal, sellers) {
  if (!deal || !Array.isArray(sellers) || sellers.length === 0) {
    return deal;
  }

  const matchedSeller = sellers.find((seller) =>
    seller?.id === deal?.seller?.id ||
    seller?.pubkey === deal?.seller?.pubkey
  );

  if (!matchedSeller) {
    return deal;
  }

  return {
    ...deal,
    seller: {
      ...matchedSeller,
      ...deal.seller,
      policy: deal.seller?.policy ?? matchedSeller.policy,
      listing: deal.seller?.listing ?? {
        item_id: matchedSeller.policy?.item_id,
        item: matchedSeller.policy?.item_name,
        list_price: matchedSeller.policy?.list_price,
        currency: matchedSeller.policy?.currency,
        fulfillment_terms: matchedSeller.policy?.fulfillment_terms,
        inventory_available: matchedSeller.policy?.inventory_available,
      },
    },
  };
}

async function agentFetchJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return await response.json();
}

function agentFormatMoney(value) {
  return typeof value === "number" ? `${value.toFixed(2)} USDC` : "—";
}

function AgentLiveApp() {
  const [tab, setTab] = useState("session");
  const [sellers, setSellers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [selectedDealId, setSelectedDealId] = useState(window.localStorage.getItem("bidmesh-current-deal") ?? "");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);
  const sourceRef = useRef(null);

  const refreshSellers = React.useCallback(async () => {
    const body = await agentFetchJson("/api/marketplace/sellers");
    setSellers(Array.isArray(body.sellers) ? body.sellers : []);
  }, []);

  const refreshDeals = React.useCallback(async () => {
    const body = await agentFetchJson("/api/deals");
    const nextDeals = Array.isArray(body.deals) ? body.deals : [];
    setDeals(nextDeals);
    const selectedStillExists = selectedDealId
      ? nextDeals.some((deal) => deal.deal_id === selectedDealId)
      : false;
    if (selectedStillExists) {
      return;
    }
    if (nextDeals[0]) {
      setSelectedDealId(nextDeals[0].deal_id);
      return;
    }
    setSelectedDealId("");
    setSelectedDeal(null);
  }, [selectedDealId]);

  const refreshDeal = React.useCallback(async (dealId) => {
    if (!dealId) return;
    const deal = await agentFetchJson(`/api/deals/${dealId}`);
    setSelectedDeal(deal);
  }, []);

  useEffect(() => {
    let active = true;
    setBooting(true);
    Promise.all([refreshSellers(), refreshDeals()])
      .catch((loadError) => {
        if (active) {
          setError(loadError.message);
        }
      })
      .finally(() => {
        if (active) {
          setBooting(false);
        }
      });
    return () => {
      active = false;
    };
  }, [refreshDeals, refreshSellers]);

  useEffect(() => {
    if (!selectedDealId) return;
    refreshDeal(selectedDealId).catch((loadError) => setError(loadError.message));
  }, [refreshDeal, selectedDealId]);

  useEffect(() => {
    if (!selectedDealId) {
      window.localStorage.removeItem("bidmesh-current-deal");
      return;
    }
    window.localStorage.setItem("bidmesh-current-deal", selectedDealId);
  }, [selectedDealId]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key === "bidmesh-current-deal" && event.newValue) {
        setSelectedDealId(event.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!selectedDealId) return;
    if (sourceRef.current) {
      sourceRef.current.close();
    }
    const stream = new EventSource(`/api/deals/${selectedDealId}/events`);
    sourceRef.current = stream;
    const onEvent = () => {
      refreshDeals().catch((loadError) => setError(loadError.message));
      refreshDeal(selectedDealId).catch((loadError) => setError(loadError.message));
    };
    stream.onmessage = onEvent;
    for (const eventType of AGENT_DEMO_EVENT_TYPES) {
      stream.addEventListener(eventType, onEvent);
    }
    stream.onerror = () => stream.close();
    return () => stream.close();
  }, [refreshDeal, refreshDeals, selectedDealId]);

  const hydratedDeals = useMemo(
    () => deals.map((deal) => agentHydrateDeal(deal, sellers)),
    [deals, sellers]
  );
  const hydratedSelectedDeal = useMemo(
    () => agentHydrateDeal(selectedDeal, sellers),
    [selectedDeal, sellers]
  );
  const topbarPhase = booting ? "syncing" : hydratedSelectedDeal?.phase ?? "idle";
  const topbarRound = booting ? "…" : hydratedSelectedDeal?.round ?? "0";
  const topbarSession = hydratedSelectedDeal?.deal_id ?? (booting ? "loading" : "none");

  return (
    <AShell
      tab={tab}
      setTab={setTab}
      topbarSession={topbarSession}
      topbarRound={topbarRound}
      topbarPhase={topbarPhase}
      inspectorDeal={hydratedSelectedDeal}
    >
      {tab === "session" && (
        <AgentSessionScreen
          deals={hydratedDeals}
          selectedDeal={hydratedSelectedDeal}
          selectedDealId={selectedDealId}
          onSelectDeal={setSelectedDealId}
          error={error}
          booting={booting}
        />
      )}
      {tab === "mcp" && <AgentDocsScreen selectedDeal={hydratedSelectedDeal} />}
      {tab === "audit" && <AgentAuditScreen deals={hydratedDeals} />}
    </AShell>
  );
}

function AgentSessionScreen({ deals, selectedDeal, selectedDealId, onSelectDeal, error, booting }) {
  const events = Array.isArray(selectedDeal?.events) ? selectedDeal.events : [];
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <ABanner tone="green">
        <div>
          <div style={{ color: A.green, fontSize: 11, letterSpacing: "0.04em" }}>
            $ bidmesh demo-backend --live-ui
          </div>
          <div style={{ color: A.fg3, fontSize: 10.5, marginTop: 2 }}>
            watching the same negotiation stream as the human page
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <ASpec label="deals" value={booting ? "…" : String(deals.length)} tone="blue" />
        <ASpec label="session" value={selectedDealId || "none"} />
        <ASpec label="phase" value={booting ? "syncing" : selectedDeal?.phase || "idle"} tone="amber" />
      </ABanner>

      {error && (
        <ABanner tone="red">
          <div style={{ color: A.red, fontSize: 11 }}>backend_error</div>
          <div style={{ color: A.fg3, fontSize: 10.5 }}>{error}</div>
        </ABanner>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 10 }}>
        <div style={{ border: `1px solid ${A.border}` }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${A.border}`, color: A.green, fontSize: 11 }}>
            sessions
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {deals.map((deal) => (
              <button
                key={deal.deal_id}
                onClick={() => onSelectDeal(deal.deal_id)}
                style={{
                  textAlign: "left",
                  background: deal.deal_id === selectedDealId ? "rgba(125,227,154,0.06)" : "transparent",
                  color: deal.deal_id === selectedDealId ? A.green : A.fg,
                  border: "none",
                  borderBottom: `1px solid ${A.border}`,
                  padding: "10px 12px",
                  fontFamily: A.font,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 11.5, overflowWrap: "anywhere" }}>{deal.item}</div>
                <div style={{ color: A.fg3, fontSize: 10.5, marginTop: 4 }}>
                  {deal.seller.handle} · {deal.phase} · {agentFormatMoney(deal.current_price)}
                </div>
              </button>
            ))}
            {deals.length === 0 && (
              <div style={{ padding: 12, color: A.fg3, fontSize: 11 }}>no sessions yet</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <ABigStat label="current_offer" value={agentFormatMoney(selectedDeal?.current_price)} sub={selectedDeal?.seller?.handle ?? "none"} accent={selectedDeal?.phase === "settled" ? A.green : A.blue} />
            <ABigStat label="round" value={selectedDeal ? `${selectedDeal.round}` : "0"} sub="live round" accent={A.amber} />
            <ABigStat label="events" value={String(events.length)} sub="streamed actions" accent={A.green} />
          </div>

          <div style={{ border: `1px solid ${A.border}`, display: "flex", flexDirection: "column", minHeight: 360 }}>
            <div style={{ padding: "6px 10px", borderBottom: `1px solid ${A.border}`, color: A.blue, fontSize: 11 }}>
              live transcript
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 8, fontSize: 11, lineHeight: 1.55 }}>
              {events.map((event) => (
                <div key={event.id} style={{ marginBottom: 8 }}>
                  <div style={{ color: A.fg5 }}>
                    <span style={{ color: event.kind === "validation.blocked" ? A.red : event.kind === "deal.settled" ? A.green : A.blue }}>
                      {event.side === "buyer" ? "→" : event.side === "seller" ? "←" : "·"}
                    </span>{" "}
                    <span style={{ color: A.blue }}>{event.method ?? event.kind}</span>{" "}
                    <APill tone={event.kind === "validation.blocked" ? "red" : event.kind === "deal.settled" ? "green" : "neutral"}>
                      {event.kind}
                    </APill>
                  </div>
                  <pre style={{ margin: "4px 0 0 16px", padding: "6px 8px", background: A.bg3, border: `1px solid ${A.border}`, borderRadius: 2, color: A.fg2, fontSize: 10.5, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
{JSON.stringify({
  id: event.id,
  timestamp: event.timestamp,
  price: event.price,
  human_text: event.human_text,
  payload: event.agent_payload,
}, null, 2)}
                  </pre>
                </div>
              ))}
              {events.length === 0 && <div style={{ color: A.fg3 }}>no events yet</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentDocsScreen({ selectedDeal }) {
  return (
    <div style={{ padding: 16, fontSize: 12, lineHeight: 1.6, color: A.fg }}>
      <div style={{ color: A.green, fontSize: 13, marginBottom: 4 }}># Live deal context</div>
      <div style={{ color: A.fg3, marginBottom: 16, maxWidth: 720 }}>
        This tab is still documentation-shaped, but it now reflects the currently selected live session.
      </div>
      <ADoc title="selected deal" code={JSON.stringify({
        deal_id: selectedDeal?.deal_id ?? null,
        item: selectedDeal?.item ?? null,
        phase: selectedDeal?.phase ?? null,
        current_price: selectedDeal?.current_price ?? null,
        seller: selectedDeal?.seller?.handle ?? null,
      }, null, 2)} />
      <ADoc title="api" code={`GET  /api/marketplace/sellers
GET  /api/deals
POST /api/deals
GET  /api/deals/:deal_id
GET  /api/deals/:deal_id/events
POST /api/deals/:deal_id/approve
POST /api/deals/:deal_id/deny
POST /api/deals/:deal_id/force-over-cap`} />
    </div>
  );
}

function AgentAuditScreen({ deals }) {
  const rows = useMemo(() => {
    return deals
      .flatMap((deal) => (deal.events ?? []).map((event) => ({ deal_id: deal.deal_id, event })))
      .sort((left, right) => Date.parse(right.event.timestamp) - Date.parse(left.event.timestamp))
      .slice(0, 100);
  }, [deals]);

  return (
    <div style={{ padding: 0, fontFamily: A.font }}>
      <div style={{ display: "grid", gridTemplateColumns: "92px 90px 1fr", padding: "8px 14px", borderBottom: `1px solid ${A.border}`, color: A.fg5, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <div>time</div><div>deal</div><div>line</div>
      </div>
      {rows.map(({ deal_id, event }, index) => (
        <div key={event.id} style={{ display: "grid", gridTemplateColumns: "92px 90px 1fr", padding: "6px 14px", fontSize: 11, lineHeight: 1.55, background: event.kind === "validation.blocked" ? "rgba(241,196,107,0.04)" : "transparent", borderBottom: index < rows.length - 1 ? `1px solid ${A.border}` : "none" }}>
          <span style={{ color: A.fg5 }}>{new Date(event.timestamp).toLocaleTimeString()}</span>
          <span style={{ color: A.fg3 }}>{deal_id}</span>
          <span style={{ color: A.fg2 }}>{event.kind} {event.human_text}</span>
        </div>
      ))}
      {rows.length === 0 && <div style={{ padding: "10px 14px", color: A.fg5, fontSize: 11 }}>tail -f audit.log waiting for events</div>}
    </div>
  );
}

window.renderBidMeshAgent = function renderBidMeshAgent() {
  ReactDOM.createRoot(document.getElementById("root")).render(<AgentLiveApp />);
};
