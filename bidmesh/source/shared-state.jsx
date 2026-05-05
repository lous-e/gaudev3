// Shared negotiation engine + state. Both human and agent views consume this.
// Implements the heuristics from the BidMesh plan deterministically.

const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

// ─── Identity helpers ──────────────────────────────────────────────────────
function shortPubkey(pk) {
  if (!pk) return "—";
  return pk.slice(0, 6) + "…" + pk.slice(-4);
}

function pubkey(seed) {
  // Deterministic-ish fake pubkey
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hex = "0123456789abcdef";
  let out = "0x";
  let x = h;
  for (let i = 0; i < 40; i++) {
    x = (x * 1103515245 + 12345 + i) >>> 0;
    out += hex[x & 15];
  }
  return out;
}

// ─── Avatar — geometric agent identity glyph ───────────────────────────────
function AgentGlyph({ seed = "x", size = 28, mono = false }) {
  // 3x3 grid stamps from seed → memorable symmetric mark
  const cells = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 131 + seed.charCodeAt(i)) >>> 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      cells.push((h & 7) > 3);
    }
  }
  // mirror cols 0 ↔ 2
  const px = size / 5;
  const hue = (h % 360);
  const fg = mono ? "currentColor" : `oklch(0.62 0.16 ${hue})`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", flexShrink: 0 }}>
      <rect width={size} height={size} rx={size * 0.22} fill={mono ? "transparent" : `oklch(0.96 0.02 ${hue})`} />
      {cells.map((on, i) => {
        if (!on) return null;
        const r = Math.floor(i / 3);
        const c = i % 3;
        const x1 = c * px + px;
        const x2 = (4 - c) * px + px;
        const y = r * px + px * 0.5;
        return (
          <g key={i}>
            <rect x={x1 - px / 2} y={y - px / 2} width={px} height={px} fill={fg} />
            <rect x={x2 - px / 2} y={y - px / 2} width={px} height={px} fill={fg} />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Negotiation engine (deterministic heuristics from plan.md) ────────────
function nextBuyerCounter(opening, max, round, maxRounds) {
  return Math.min(max, opening + ((max - opening) * round) / maxRounds);
}
function nextSellerCounter(list, min, round, maxRounds) {
  return Math.max(min, list - ((list - min) * round) / maxRounds);
}
function decideBuyerMove({ sellerPrice, targetPrice, maxPrice, round, maxRounds }) {
  if (sellerPrice <= targetPrice) return "accept";
  if (sellerPrice <= maxPrice && round >= maxRounds) return "accept";
  if (sellerPrice > maxPrice && round >= maxRounds) return "walk";
  return "counter";
}
function decideSellerMove({ buyerPrice, listPrice, minPrice, round, maxRounds }) {
  if (buyerPrice >= listPrice) return "accept";
  if (buyerPrice >= minPrice && round >= maxRounds) return "accept";
  if (buyerPrice < minPrice && round >= maxRounds) return "walk";
  return "counter";
}

// ─── Default policies (USB-C cable scenario from plan.md) ──────────────────
const DEFAULT_BUYER_INTENT = {
  item: "USB-C cable",
  quantity: 1,
  must_have: { length_m: 1, power_w_min: 60 },
  max_price: 5,
  target_price: 4,
  currency: "USDC",
  max_rounds: 3,
  negotiation_style: "balanced",
  require_human_confirmation_before_payment: true,
};

const DEFAULT_SELLER_POLICY = {
  item_id: "cable-usbc-001",
  item_name: "USB-C cable, 1m, 60W PD",
  inventory_available: 47,
  list_price: 6,
  min_price: 4.5,
  currency: "USDC",
  fulfillment_terms: "redemption code, immediate",
  negotiation_style: "balanced",
  max_rounds: 3,
};

const BUYER_PUBKEY = pubkey("buyer:tessa");
const SELLER_PUBKEY = pubkey("seller:cableworks");

// ─── Negotiation transcript builder ────────────────────────────────────────
// Produces the full deal trace given policies + a forceOverCap flag.
function buildTranscript(intent, policy, opts = {}) {
  const { forceOverCap = false } = opts;
  const events = [];
  const dealId = "deal_" + Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  let t = 0;
  const push = (e) => events.push({ ...e, t: t });

  const opening = Math.min(intent.target_price ?? intent.max_price * 0.8, intent.max_price);
  const maxRounds = Math.min(intent.max_rounds, policy.max_rounds);

  push({ kind: "open", side: "buyer", method: "bidmesh.negotiate.open", price: opening, round: 1,
    note: `Opening offer for ${intent.quantity}× ${intent.item}` });
  t += 800;

  let buyerPrice = opening;
  let sellerPrice = policy.list_price;
  let round = 1;
  let settled = false;
  let walked = null;

  // Seller responds to opening
  const sellerInitMove = decideSellerMove({
    buyerPrice: opening, listPrice: policy.list_price, minPrice: policy.min_price,
    round: 1, maxRounds,
  });
  if (sellerInitMove === "accept") {
    push({ kind: "accept", side: "seller", method: "bidmesh.negotiate.open", price: opening, round: 1, note: "Accepts opening offer" });
    t += 600;
    settled = opening;
  } else if (sellerInitMove === "walk") {
    push({ kind: "walk", side: "seller", price: opening, round: 1, reason_code: "price_too_low", note: "No overlap" });
    walked = "seller";
  } else {
    sellerPrice = nextSellerCounter(policy.list_price, policy.min_price, 1, maxRounds);
    push({ kind: "counter", side: "seller", method: "bidmesh.negotiate.open", price: sellerPrice, round: 1,
      note: `Counter from list ${policy.list_price}` });
    t += 700;
  }

  while (!settled && !walked && round < maxRounds + 1) {
    round += 1;
    if (round > maxRounds + 1) break;

    // Buyer's turn
    const bMove = decideBuyerMove({
      sellerPrice, targetPrice: intent.target_price ?? intent.max_price * 0.85,
      maxPrice: intent.max_price, round, maxRounds,
    });
    if (bMove === "accept") {
      push({ kind: "accept", side: "buyer", method: "bidmesh.negotiate.accept", price: sellerPrice, round, note: "Within budget" });
      t += 600;
      settled = sellerPrice;
      break;
    }
    if (bMove === "walk") {
      push({ kind: "walk", side: "buyer", price: sellerPrice, round, reason_code: "price_too_high", note: "Above max_price" });
      walked = "buyer";
      break;
    }
    buyerPrice = nextBuyerCounter(opening, intent.max_price, round, maxRounds);
    push({ kind: "counter", side: "buyer", method: "bidmesh.negotiate.counter", price: buyerPrice, round, note: "Concession schedule" });
    t += 700;

    // Seller's turn
    const sMove = decideSellerMove({
      buyerPrice, listPrice: policy.list_price, minPrice: policy.min_price,
      round, maxRounds,
    });
    if (sMove === "accept") {
      push({ kind: "accept", side: "seller", method: "bidmesh.negotiate.accept", price: buyerPrice, round, note: "Above floor" });
      t += 600;
      settled = buyerPrice;
      break;
    }
    if (sMove === "walk") {
      push({ kind: "walk", side: "seller", price: buyerPrice, round, reason_code: "price_too_low", note: "Below min_price" });
      walked = "seller";
      break;
    }
    sellerPrice = nextSellerCounter(policy.list_price, policy.min_price, round, maxRounds);
    push({ kind: "counter", side: "seller", method: "bidmesh.negotiate.counter", price: sellerPrice, round, note: "Concession schedule" });
    t += 700;
  }

  // Forced over-cap injection (the safety story)
  if (forceOverCap && settled !== false) {
    const forced = +(intent.max_price + 2).toFixed(2);
    push({
      kind: "block", side: "shim", method: "validation.shim.buyer", price: forced, round: round + 1,
      reason_code: "accepted_price_exceeds_max_price",
      note: `Mutated agent attempted ${forced} ${intent.currency}; cap is ${intent.max_price}`,
    });
    t += 400;
    push({ kind: "walk", side: "buyer", price: forced, round: round + 1, reason_code: "validation_denied", note: "Shim blocked, walking" });
    walked = "buyer";
    settled = false;
  }

  // Settlement steps if settled
  if (settled !== false && !walked) {
    push({ kind: "confirm-request", side: "buyer", price: settled, round, note: "Awaiting human confirmation" });
    t += 400;
    push({ kind: "confirm-granted", side: "human", price: settled, round, note: "User typed /confirm" });
    t += 400;
    push({
      kind: "settle", side: "buyer", method: "x402.settle", price: settled, round,
      txHash: "0x" + Math.random().toString(16).slice(2, 10).padEnd(8, "a") + "…",
      note: "USDC transfer on base-sepolia",
    });
    t += 600;
    push({
      kind: "artifact", side: "seller", price: settled, round,
      artifact: "redemption-code-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      note: "Proof artifact released",
    });
  }

  return {
    dealId,
    events,
    settled,
    walked,
    finalPrice: settled || null,
    intent,
    policy,
    buyer: { pubkey: BUYER_PUBKEY, handle: "tessa.agent" },
    seller: { pubkey: SELLER_PUBKEY, handle: "cableworks.agent" },
  };
}

// ─── Hook: animated transcript playback ────────────────────────────────────
function useNegotiation({ intent = DEFAULT_BUYER_INTENT, policy = DEFAULT_SELLER_POLICY,
                         pace = 1, forceOverCap = false, autoplay = true } = {}) {
  const transcript = useMemo(
    () => buildTranscript(intent, policy, { forceOverCap }),
    [intent, policy, forceOverCap]
  );
  const [step, setStep] = useState(autoplay ? 0 : transcript.events.length);
  const [playing, setPlaying] = useState(autoplay);

  useEffect(() => {
    setStep(autoplay ? 0 : transcript.events.length);
    setPlaying(autoplay);
  }, [transcript, autoplay]);

  useEffect(() => {
    if (!playing) return;
    if (step >= transcript.events.length) {
      setPlaying(false);
      return;
    }
    const baseDelay = step === 0 ? 400 : 1100;
    const id = setTimeout(() => setStep((s) => s + 1), baseDelay / Math.max(0.25, pace));
    return () => clearTimeout(id);
  }, [step, playing, pace, transcript]);

  const visibleEvents = transcript.events.slice(0, step);
  const currentEvent = transcript.events[step - 1] || null;

  return {
    transcript,
    events: visibleEvents,
    current: currentEvent,
    step, totalSteps: transcript.events.length,
    playing,
    play: () => { if (step >= transcript.events.length) setStep(0); setPlaying(true); },
    pause: () => setPlaying(false),
    restart: () => { setStep(0); setPlaying(true); },
    setStep,
  };
}

// ─── Format helpers ────────────────────────────────────────────────────────
const fmtUSDC = (n) => (n == null ? "—" : Number(n).toFixed(2) + " USDC");
const fmtUSD = (n) => (n == null ? "—" : "$" + Number(n).toFixed(2));
const fmtPrice = (n, mode = "usdc") => (mode === "usd" ? fmtUSD(n) : fmtUSDC(n));

// expose to window for cross-script access
Object.assign(window, {
  AgentGlyph,
  shortPubkey,
  pubkey,
  buildTranscript,
  useNegotiation,
  DEFAULT_BUYER_INTENT,
  DEFAULT_SELLER_POLICY,
  BUYER_PUBKEY,
  SELLER_PUBKEY,
  fmtUSDC,
  fmtUSD,
  fmtPrice,
  nextBuyerCounter,
  nextSellerCounter,
});
