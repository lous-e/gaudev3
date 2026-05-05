const { useEffect, useMemo, useRef, useState } = React;
const HUMAN_DEMO_EVENT_TYPES = [
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

function humanApiUrl(path) {
  return path;
}

async function humanFetchJson(path, options) {
  const response = await fetch(humanApiUrl(path), options);
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.error === "string") {
        message = body.error;
      }
    } catch (_error) {
      // keep fallback message
    }
    throw new Error(message);
  }
  return await response.json();
}

function humanFormatMoney(value) {
  if (typeof value !== "number") return "—";
  return `${value.toFixed(2)} USDC`;
}

function humanEventTone(event) {
  if (!event) return "neutral";
  if (event.kind === "validation.blocked" || event.kind === "deal.walked") return "red";
  if (event.kind === "human.confirmation_requested") return "amber";
  if (event.kind === "settlement.mocked" || event.kind === "deal.settled") return "green";
  if (event.kind === "marketplace.scan_started" || event.kind === "marketplace.selection_finalized") return "sage";
  return event.side === "seller" ? "amber" : event.side === "buyer" ? "sage" : "neutral";
}

function humanIsCompact() {
  return typeof window !== "undefined" && window.innerWidth < 1100;
}

function humanHydrateDeal(deal, sellers) {
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

function humanWorkflowSteps(deal) {
  const events = Array.isArray(deal?.events) ? deal.events : [];
  const hasKind = (kind) => events.some((event) => event.kind === kind);

  return [
    {
      label: "Search sellers",
      detail: deal?.market_scan
        ? `${deal.market_scan.searched_count} checked, ${deal.market_scan.candidates.filter((candidate) => candidate.status !== "rejected").length} viable`
        : "Waiting for marketplace scan",
      done: hasKind("marketplace.selection_finalized"),
    },
    {
      label: "Negotiate best option",
      detail: deal?.seller?.handle ? `Selected ${deal.seller.handle}` : "Waiting for quotes",
      done: hasKind("rpc.received"),
    },
    {
      label: "Run safety checks",
      detail: "Budget and policy checks before payment",
      done: hasKind("validation.allowed") || hasKind("validation.blocked"),
    },
    {
      label: "Human decision",
      detail: deal?.phase === "settled"
        ? "Approved and mocked payment sent"
        : deal?.phase === "walked"
          ? "Declined or blocked"
          : deal?.pending_approval
            ? "Ready for your decision"
            : "Waiting for final quote",
      done: hasKind("deal.settled") || hasKind("deal.walked"),
      active: Boolean(deal?.pending_approval),
    },
  ];
}

function HumanLiveApp() {
  const [tab, setTab] = useState("deals");
  const [showIntentModal, setShowIntentModal] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const eventSourceRef = useRef(null);

  const refreshSellers = React.useCallback(async () => {
    const body = await humanFetchJson("/api/marketplace/sellers");
    setSellers(body.sellers ?? []);
  }, []);

  const refreshDeals = React.useCallback(async () => {
    const body = await humanFetchJson("/api/deals");
    const nextDeals = Array.isArray(body.deals) ? body.deals : [];
    setDeals(nextDeals);
    setSelectedDeal((current) => {
      if (!current) return current;
      return nextDeals.find((deal) => deal.deal_id === current.deal_id) ?? current;
    });
    const selectedStillExists = selectedDealId
      ? nextDeals.some((deal) => deal.deal_id === selectedDealId)
      : false;
    if (selectedStillExists) {
      return;
    }
    if (nextDeals.length > 0) {
      setSelectedDealId(nextDeals[0].deal_id);
      return;
    }
    setSelectedDealId("");
    setSelectedDeal(null);
  }, [selectedDealId]);

  const refreshDeal = React.useCallback(async (dealId) => {
    if (!dealId) return;
    const deal = await humanFetchJson(`/api/deals/${dealId}`);
    setSelectedDeal(deal);
    setDeals((current) =>
      current.map((candidate) => candidate.deal_id === dealId ? deal : candidate)
    );
  }, []);

  useEffect(() => {
    refreshSellers().catch((loadError) => setError(loadError.message));
    refreshDeals().catch((loadError) => setError(loadError.message));
  }, [refreshDeals, refreshSellers]);

  useEffect(() => {
    if (!selectedDealId) return;
    refreshDeal(selectedDealId).catch((loadError) => setError(loadError.message));
  }, [refreshDeal, selectedDealId]);

  useEffect(() => {
    if (!selectedDealId) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const stream = new EventSource(`/api/deals/${selectedDealId}/events`);
    eventSourceRef.current = stream;
    const onEvent = () => {
      refreshDeal(selectedDealId).catch((loadError) => setError(loadError.message));
      refreshDeals().catch((loadError) => setError(loadError.message));
    };
    stream.onmessage = onEvent;
    for (const eventType of HUMAN_DEMO_EVENT_TYPES) {
      stream.addEventListener(eventType, onEvent);
    }
    stream.onerror = () => {
      stream.close();
    };

    return () => {
      stream.close();
    };
  }, [refreshDeal, refreshDeals, selectedDealId]);

  useEffect(() => {
    if (!selectedDealId) return;
    window.localStorage.setItem("bidmesh-current-deal", selectedDealId);
  }, [selectedDealId]);

  const activeDeals = deals.filter((deal) => deal.phase !== "settled" && deal.phase !== "walked");
  const settledDeals = deals.filter((deal) => deal.phase === "settled");
  const blockedDeals = deals.filter((deal) =>
    Array.isArray(deal.events) && deal.events.some((event) => event.kind === "validation.blocked")
  );
  const hydratedDeals = useMemo(
    () => deals.map((deal) => humanHydrateDeal(deal, sellers)),
    [deals, sellers]
  );
  const hydratedSelectedDeal = useMemo(
    () => humanHydrateDeal(selectedDeal, sellers),
    [selectedDeal, sellers]
  );

  const breadcrumb = {
    deals: "Workspace · Deals",
    deal: hydratedSelectedDeal ? `Workspace · Deals · ${hydratedSelectedDeal.item}` : "Workspace · Deals · Live deal",
    policies: "Workspace · Policies",
    audit: "Workspace · Audit log",
  }[tab];

  async function createIntent(form) {
    setCreating(true);
    setError("");
    try {
      const payload = {
        intent: {
          item: form.item,
          quantity: 1,
          must_have: {
            length_m: 1,
            power_w_min: 60,
          },
          max_price: Number(form.max_price),
          target_price: Number(form.target_price),
          currency: "USDC",
          negotiation_style: "balanced",
          max_rounds: 3,
          allow_partial_match: false,
          require_human_confirmation_before_payment: true,
        },
      };
      const created = await humanFetchJson("/api/deals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refreshDeals();
      setSelectedDealId(created.deal_id);
      setTab("deal");
      setShowIntentModal(false);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setCreating(false);
    }
  }

  async function runDealAction(action) {
    if (!selectedDeal) return;
    setPendingAction(action);
    setError("");
    try {
      await humanFetchJson(`/api/deals/${selectedDeal.deal_id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      await refreshDeal(selectedDeal.deal_id);
      await refreshDeals();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setPendingAction("");
    }
  }

  return (
    <HShell
      tab={tab}
      setTab={setTab}
      crumb={breadcrumb}
      onNewIntent={() => setShowIntentModal(true)}
    >
      {error && (
        <HCard style={{ marginBottom: 16, background: H.dangerBg, borderColor: H.dangerBd }}>
          <div style={{ color: H.danger, fontWeight: 600, marginBottom: 4 }}>Backend error</div>
          <div style={{ color: H.fg2, fontSize: 13 }}>{error}</div>
        </HCard>
      )}

      {tab === "deals" && (
        <HumanDealsScreen
          sellers={sellers}
          deals={hydratedDeals}
          activeDeals={activeDeals}
          settledDeals={settledDeals}
          blockedDeals={blockedDeals}
          onOpenDeal={(dealId) => {
            setSelectedDealId(dealId);
            setTab("deal");
          }}
          onCreateIntent={() => setShowIntentModal(true)}
        />
      )}

      {tab === "deal" && (
        <HumanDealScreen
          deal={hydratedSelectedDeal}
          onApprove={() => runDealAction("approve")}
          onDeny={() => runDealAction("deny")}
          pendingAction={pendingAction}
        />
      )}

      {tab === "policies" && <HumanPoliciesLive selectedDeal={hydratedSelectedDeal} />}
      {tab === "audit" && <HumanAuditLive deals={hydratedDeals} />}

      {showIntentModal && (
        <HumanIntentModal
          sellers={sellers}
          creating={creating}
          onClose={() => setShowIntentModal(false)}
          onSubmit={createIntent}
        />
      )}
    </HShell>
  );
}

function HumanDealsScreen({
  sellers,
  deals,
  activeDeals,
  settledDeals,
  blockedDeals,
  onOpenDeal,
  onCreateIntent,
}) {
  const compact = humanIsCompact();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1120 }}>
      <div>
        <div style={{ color: H.fg3, fontSize: 13 }}>Live demo backend</div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "6px 0 0" }}>
          Dev2 marketplace, connected.
        </h1>
        <div style={{ color: H.fg3, fontSize: 13, marginTop: 8 }}>
          Start one intent and the demo fans out across every matching seller, compares offers, and brings back one recommendation for approval.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
        <HStat label="Seeded sellers" value={String(sellers.length)} sub="searched by default for each new intent" tone="sage" />
        <HStat label="Active deals" value={String(activeDeals.length)} sub="open, countering, accepted" tone="amber" />
        <HStat label="Settled" value={String(settledDeals.length)} sub="mock settlement completed" tone="green" />
        <HStat label="Blocked by policy" value={String(blockedDeals.length)} sub="safety checks that prevented payment" tone="neutral" />
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Marketplace sellers</h2>
          <div style={{ flex: 1 }} />
          <HButton kind="primary" onClick={onCreateIntent}>+ New intent</HButton>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 14 }}>
          {sellers.map((seller) => (
            <HCard key={seller.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AgentGlyph seed={seller.handle} size={24} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{seller.handle}</div>
                  <div style={{ color: H.fg3, fontSize: 12 }}>{seller.policy.item_name}</div>
                </div>
                <HPill tone="sage">{seller.policy.inventory_available} in stock</HPill>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <HPill>{humanFormatMoney(seller.policy.list_price)} list</HPill>
                <HPill>{humanFormatMoney(seller.policy.min_price)} floor</HPill>
                <HPill tone="amber">{seller.policy.fulfillment_terms}</HPill>
              </div>
              <div style={{ marginTop: 14, color: H.fg2, fontSize: 13 }}>
                Tags: {Array.isArray(seller.tags) ? seller.tags.join(", ") : "none"}
              </div>
            </HCard>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>Deals</h2>
          <div style={{ flex: 1 }} />
          <div style={{ color: H.fg3, fontSize: 13 }}>{deals.length} total</div>
        </div>
        <HCard padding={0}>
          <div style={{ display: "grid", gridTemplateColumns: compact ? "1.3fr 0.9fr 0.9fr auto" : "1.5fr 1fr 0.9fr 0.9fr 1.1fr auto", padding: "10px 16px", color: H.fg3, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, borderBottom: `1px solid ${H.border}`, background: H.surfSoft }}>
            <div>Item</div>
            {!compact && <div>Seller</div>}
            <div>Phase</div>
            <div>Offer</div>
            {!compact && <div>Market scan</div>}
            <div style={{ textAlign: "right" }}>Open</div>
          </div>
          {deals.length === 0 && (
            <div style={{ padding: 24, color: H.fg3, fontSize: 13 }}>No deals yet. Create one from the marketplace above.</div>
          )}
          {deals.map((deal, index) => (
            <div key={deal.deal_id} style={{ display: "grid", gridTemplateColumns: compact ? "1.3fr 0.9fr 0.9fr auto" : "1.5fr 1fr 0.9fr 0.9fr 1.1fr auto", padding: "12px 16px", fontSize: 13, alignItems: "center", gap: 12, borderBottom: index < deals.length - 1 ? `1px solid ${H.border}` : "none" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{deal.item}</div>
                {compact && (
                  <div style={{ color: H.fg3, fontSize: 12, marginTop: 4 }}>
                    {deal.seller.handle}
                  </div>
                )}
              </div>
              {!compact && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <AgentGlyph seed={deal.seller.handle} size={20} />
                  <span style={{ color: H.fg2, minWidth: 0, overflowWrap: "anywhere" }}>{deal.seller.handle}</span>
                </div>
              )}
              <div><HPill tone={deal.phase === "settled" ? "green" : deal.phase === "walked" ? "red" : "amber"}>{deal.phase}</HPill></div>
              <div style={{ fontFamily: H.mono }}>{humanFormatMoney(deal.current_price)}</div>
              {!compact && (
                <div style={{ color: H.fg3 }}>
                  {deal.market_scan ? `${deal.market_scan.searched_count} reviewed` : `${Array.isArray(deal.events) ? deal.events.length : 0} events`}
                </div>
              )}
              <div style={{ textAlign: "right" }}>
                <HButton size="sm" kind="ghost" onClick={() => onOpenDeal(deal.deal_id)}>View</HButton>
              </div>
            </div>
          ))}
        </HCard>
      </div>
    </div>
  );
}

function HumanDealScreen({ deal, onApprove, onDeny, pendingAction }) {
  if (!deal) {
    return (
      <HCard>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No live deal selected</div>
        <div style={{ color: H.fg3, fontSize: 13 }}>Create a deal from the marketplace or open an existing one.</div>
      </HCard>
    );
  }

  const events = Array.isArray(deal.events) ? deal.events : [];
  const lastEvent = events[events.length - 1];
  const awaitingApproval = Boolean(deal.pending_approval);
  const sellerPolicy = deal.seller?.policy ?? {
    min_price: deal.seller?.listing?.min_price,
    list_price: deal.seller?.listing?.list_price,
    fulfillment_terms: deal.seller?.listing?.fulfillment_terms,
  };
  const compact = humanIsCompact();
  const workflowSteps = humanWorkflowSteps(deal);
  const marketCandidates = Array.isArray(deal.market_scan?.candidates) ? deal.market_scan.candidates : [];
  const viableCandidates = marketCandidates.filter((candidate) => candidate.status !== "rejected");
  const alternateCandidates = marketCandidates.filter((candidate) => candidate.seller_id !== deal.seller?.id).slice(0, 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1080 }}>
      <div>
        <div style={{ color: H.fg3, fontSize: 13 }}>
          <span>Deals</span> <span style={{ color: H.fg4 }}>›</span> <span>{deal.item}</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "6px 0 0" }}>{deal.item}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <HPulsingDot />
          <span style={{ color: H.fg3, fontSize: 13 }}>
            {deal.seller.handle} · {deal.phase} · round {deal.round}
          </span>
          <span style={{ color: H.fg4, fontFamily: H.mono, fontSize: 11 }}>{deal.deal_id}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1.15fr 0.85fr", gap: 16 }}>
        <HCard style={awaitingApproval ? { background: H.warnTint, borderColor: H.warnBd } : deal.phase === "settled" ? { background: H.successBg, borderColor: H.successBd } : {}}>
          <HEyebrow>Recommended transaction</HEyebrow>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 10 }}>
            <AgentGlyph seed={deal.seller.handle} size={34} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>{deal.seller.handle}</div>
                <HPill tone={deal.phase === "settled" ? "green" : awaitingApproval ? "amber" : "sage"}>{deal.phase}</HPill>
              </div>
              <div style={{ color: H.fg2, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
                {deal.market_scan?.selected_reason ?? `Selected for ${deal.item}.`}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 18 }}>
            <HumanSummaryMetric label="Final price" value={humanFormatMoney(deal.current_price)} sub="within configured budget" tone="green" />
            <HumanSummaryMetric label="Seller floor" value={humanFormatMoney(sellerPolicy.min_price)} sub="list floor benchmark" tone="neutral" />
            <HumanSummaryMetric label="Terms" value={sellerPolicy.fulfillment_terms ?? "—"} sub="fulfillment" tone="amber" compactText />
            <HumanSummaryMetric label="Agents checked" value={String(deal.market_scan?.searched_count ?? 1)} sub={`${viableCandidates.length} viable offers`} tone="sage" />
          </div>
          {alternateCandidates.length > 0 && (
            <div style={{ marginTop: 16, color: H.fg2, fontSize: 13 }}>
              Also reviewed: {alternateCandidates.map((candidate) =>
                `${candidate.handle} (${candidate.final_price != null ? humanFormatMoney(candidate.final_price) : candidate.reason})`
              ).join(" · ")}
            </div>
          )}
        </HCard>

        <HCard>
          <HEyebrow>Your decision</HEyebrow>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 10 }}>
            {awaitingApproval
              ? `Approve ${humanFormatMoney(deal.pending_approval.amount)} to complete the purchase?`
              : deal.phase === "settled"
                ? "The transaction has been approved and mocked settlement completed."
                : deal.phase === "walked"
                  ? "This deal is closed. You can review why in the workflow below."
                  : "The agent is still working through the marketplace and negotiation steps."}
          </div>
          <div style={{ color: H.fg2, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            Accepting means we proceed with the selected seller, price, and fulfillment terms shown here. Denying walks away from this deal without payment.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {awaitingApproval && (
              <>
                <HButton kind="primary" onClick={onApprove} disabled={pendingAction !== ""}>Accept & mock pay</HButton>
                <HButton kind="danger" onClick={onDeny} disabled={pendingAction !== ""}>Deny</HButton>
              </>
            )}
            {!awaitingApproval && deal.phase === "settled" && (
              <>
                <HPill tone="green">mock settled</HPill>
                <HPill>{deal.receipt.network}</HPill>
              </>
            )}
            {!awaitingApproval && deal.phase !== "settled" && deal.phase !== "walked" && (
              <HPill tone="sage">Waiting for recommendation to finish</HPill>
            )}
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${H.border}` }}>
            <div style={{ fontSize: 12, color: H.fg3, marginBottom: 8 }}>How we got here</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {workflowSteps.map((step, index) => (
                <div key={step.label} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10, alignItems: "start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, background: step.done ? H.accentBg : step.active ? H.warnBg : H.bg2, color: step.done ? H.accentMid : step.active ? H.warn : H.fg3, border: `1px solid ${step.done ? H.accentBd : step.active ? H.warnBd : H.border}` }}>
                    {step.done ? "✓" : index + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{step.label}</div>
                    <div style={{ color: H.fg2, fontSize: 12, marginTop: 2 }}>{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </HCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 16 }}>
        <HCard>
          <HEyebrow>Current offer</HEyebrow>
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 6, fontFamily: H.mono }}>
            {humanFormatMoney(deal.current_price)}
          </div>
          <div style={{ color: H.fg3, fontSize: 13, marginTop: 4 }}>
            Seller floor {humanFormatMoney(sellerPolicy.min_price)} · list {humanFormatMoney(sellerPolicy.list_price)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <HPill tone="sage">target 4.00 USDC</HPill>
            <HPill tone="red">cap {humanFormatMoney(deal.current_price && deal.current_price > 5 ? deal.current_price : 5)}</HPill>
            <HPill>{sellerPolicy.fulfillment_terms}</HPill>
          </div>
        </HCard>

        <HCard>
          <HEyebrow>Market scan</HEyebrow>
          <div style={{ color: H.fg2, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            The agent checked {deal.market_scan?.searched_count ?? 1} sellers, found {viableCandidates.length} viable options, and selected {deal.seller.handle}.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {marketCandidates.slice(0, compact ? 3 : 5).map((candidate) => (
              <div key={candidate.seller_id} style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1.15fr 0.85fr auto", gap: 10, alignItems: "center", padding: "10px 12px", border: `1px solid ${H.border}`, borderRadius: 8, background: candidate.seller_id === deal.seller.id ? H.accentBg : H.surfSoft }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>{candidate.handle}</span>
                    <HPill tone={candidate.status === "selected" ? "sage" : candidate.status === "rejected" ? "red" : "neutral"}>{candidate.status}</HPill>
                  </div>
                  <div style={{ color: H.fg2, fontSize: 12, marginTop: 4, overflowWrap: "anywhere" }}>{candidate.reason}</div>
                </div>
                {!compact && (
                  <div style={{ color: H.fg3, fontSize: 12 }}>
                    {candidate.final_price != null ? humanFormatMoney(candidate.final_price) : "No valid quote"} · {candidate.fulfillment_terms}
                  </div>
                )}
                <div style={{ textAlign: compact ? "left" : "right", color: H.fg3, fontSize: 12 }}>
                  round {candidate.rounds}
                </div>
              </div>
            ))}
          </div>
        </HCard>
      </div>

      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.01em" }}>Negotiation workflow</h2>
        <HCard padding={0}>
          {events.map((event, index) => (
            <div key={event.id} style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "110px minmax(0, 1fr) 180px", gap: 14, padding: "12px 18px", borderBottom: index < events.length - 1 ? `1px solid ${H.border}` : "none", alignItems: compact ? "start" : "center", fontSize: 13 }}>
              <span style={{ fontFamily: H.mono, color: H.fg4, fontSize: 11, whiteSpace: "nowrap" }}>{new Date(event.timestamp).toLocaleTimeString()}</span>
              <div style={{ display: "flex", alignItems: compact ? "flex-start" : "center", gap: 10, minWidth: 0, flexWrap: compact ? "wrap" : "nowrap" }}>
                <HPill tone={humanEventTone(event)}>{event.kind}</HPill>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <strong style={{ fontWeight: 500 }}>{event.side}</strong>{" "}
                  <span style={{ color: H.fg2 }}>{event.human_text}</span>
                </span>
              </div>
              <span style={{ fontFamily: H.mono, color: H.fg3, fontSize: 11, textAlign: compact ? "left" : "right", overflowWrap: "anywhere" }}>
                {event.method ?? event.kind}
              </span>
            </div>
          ))}
          {events.length === 0 && (
            <div style={{ padding: 18, color: H.fg3, fontSize: 13 }}>No transcript yet.</div>
          )}
        </HCard>
      </div>

      <HCard>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Latest event</div>
        <div style={{ color: H.fg2, fontSize: 13 }}>
          {lastEvent ? lastEvent.human_text : "No events yet."}
        </div>
      </HCard>
    </div>
  );
}

function HumanPoliciesLive({ selectedDeal }) {
  const item = selectedDeal?.item ?? "USB-C cable";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 760 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Spending policies</h1>
        <div style={{ color: H.fg3, fontSize: 13, marginTop: 8 }}>
          These stay static in the demo, but they are the live constraints the backend enforces before settlement.
        </div>
      </div>
      <HCard>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{item}</div>
          <span style={{ marginLeft: 10 }}><HPill tone="sage">active</HPill></span>
        </div>
        <PolicyRowLive label="Item" value={item} />
        <PolicyRowLive label="Currency" value="USDC" />
        <PolicyRowLive label="Maximum price" value="5.00 USDC" tone="red" />
        <PolicyRowLive label="Target price" value="4.00 USDC" tone="sage" />
        <PolicyRowLive label="Confirmation" value="Required before payment" tone="amber" last />
      </HCard>
    </div>
  );
}

function HumanSummaryMetric({ label, value, sub, tone = "neutral", compactText = false }) {
  const accent = { neutral: H.fg, sage: H.accentMid, green: H.success, amber: H.warn }[tone] || H.fg;
  return (
    <div style={{
      minWidth: 0,
      border: `1px solid ${H.border}`,
      borderRadius: 10,
      padding: 16,
      background: H.surf,
    }}>
      <div style={{ color: H.fg2, fontSize: 12 }}>{label}</div>
      <div style={{
        marginTop: 8,
        color: accent,
        fontWeight: 600,
        letterSpacing: "-0.03em",
        lineHeight: compactText ? 1.2 : 1.05,
        fontSize: compactText ? 18 : 36,
        overflowWrap: "anywhere",
        wordBreak: "break-word",
      }}>
        {value}
      </div>
      <div style={{ color: H.fg3, fontSize: 12, marginTop: 8, lineHeight: 1.4, overflowWrap: "anywhere" }}>{sub}</div>
    </div>
  );
}

function PolicyRowLive({ label, value, tone = "neutral", last = false }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", padding: "14px 0", gap: 16, borderBottom: last ? "none" : `1px solid ${H.border}` }}>
      <div style={{ fontSize: 13, color: H.fg2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: tone === "red" ? H.danger : tone === "sage" ? H.accentMid : tone === "amber" ? H.warn : H.fg }}>
        {value}
      </div>
    </div>
  );
}

function HumanAuditLive({ deals }) {
  const rows = useMemo(() => {
    return deals
      .flatMap((deal) => (deal.events ?? []).map((event) => ({ deal_id: deal.deal_id, event })))
      .sort((left, right) => Date.parse(right.event.timestamp) - Date.parse(left.event.timestamp))
      .slice(0, 50);
  }, [deals]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1080 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Audit log</h1>
        <div style={{ color: H.fg3, fontSize: 13, marginTop: 8 }}>Live frontend projection of the backend event stream.</div>
      </div>
      <HCard padding={0}>
        {rows.map(({ deal_id, event }, index) => (
          <div key={event.id} style={{ display: "grid", gridTemplateColumns: "92px 120px 1fr", gap: 14, padding: "11px 18px", fontSize: 13, alignItems: "center", borderBottom: index < rows.length - 1 ? `1px solid ${H.border}` : "none", background: event.kind === "validation.blocked" ? H.warnTint : "transparent" }}>
            <span style={{ fontFamily: H.mono, color: H.fg4, fontSize: 11 }}>{new Date(event.timestamp).toLocaleTimeString()}</span>
            <span style={{ color: H.fg2, fontFamily: H.mono, fontSize: 11 }}>{deal_id}</span>
            <span style={{ color: H.fg2 }}>
              <strong>{event.kind}</strong> · {event.human_text}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ padding: 18, color: H.fg3, fontSize: 13 }}>No audit events yet.</div>
        )}
      </HCard>
    </div>
  );
}

function HumanIntentModal({ sellers, creating, onClose, onSubmit }) {
  const [item, setItem] = useState("USB-C cable");
  const [targetPrice, setTargetPrice] = useState("4");
  const [maxPrice, setMaxPrice] = useState("5");

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(27,27,24,0.32)", display: "grid", placeItems: "center", zIndex: 50, fontFamily: H.font }} onClick={onClose}>
      <div style={{ background: H.surf, border: `1px solid ${H.border}`, borderRadius: 12, width: 480, padding: 24, boxShadow: "0 18px 48px rgba(27,27,24,0.18)" }} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>New live intent</h2>
        <div style={{ color: H.fg3, fontSize: 13, marginTop: 4 }}>This searches all matching sellers, negotiates in parallel, then returns one recommendation.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
          <Field label="Item" value={item} onChange={setItem} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Target price (USDC)" value={targetPrice} onChange={setTargetPrice} mono />
            <Field label="Max price (USDC)" value={maxPrice} onChange={setMaxPrice} mono accent={H.warn} />
          </div>
          <div style={{ background: H.bg2, border: `1px solid ${H.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: H.fg2 }}>
            The backend will review up to {sellers.length} seeded sellers, pick the best viable option inside your budget, then pause for human confirmation before payment.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 22, justifyContent: "flex-end" }}>
          <HButton kind="ghost" onClick={onClose} disabled={creating}>Cancel</HButton>
          <HButton kind="primary" onClick={() => onSubmit({ item, target_price: targetPrice, max_price: maxPrice })} disabled={creating}>
            {creating ? "Creating…" : "Start negotiation"}
          </HButton>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, mono, accent }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: H.fg3, fontWeight: 500 }}>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={{ padding: "8px 10px", border: `1px solid ${H.borderStrong}`, borderRadius: 6, fontFamily: mono ? H.mono : H.font, fontSize: 13, color: accent || H.fg, background: H.surf, outline: "none" }} />
    </label>
  );
}

window.renderBidMeshHuman = function renderBidMeshHuman() {
  ReactDOM.createRoot(document.getElementById("root")).render(<HumanLiveApp />);
};
