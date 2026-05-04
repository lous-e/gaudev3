import type {
  BuyerIntent,
  BuyerStrategy,
  NegotiationMove,
  SellerPolicy
} from "./types";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function defaultBuyerStrategy(intent: BuyerIntent): BuyerStrategy {
  const target = Math.min(
    intent.target_price ?? roundCurrency(intent.max_price * 0.8),
    intent.max_price
  );
  const opening = Math.min(target, intent.max_price);

  return {
    opening_offer: roundCurrency(opening),
    preferred_price: roundCurrency(target),
    concession_schedule: "linear",
    walkaway_after_rounds: intent.max_rounds
  };
}

export function decideBuyerMove(input: {
  sellerPrice: number;
  targetPrice: number;
  maxPrice: number;
  round: number;
  maxRounds: number;
}): NegotiationMove {
  if (input.sellerPrice > input.maxPrice) {
    return input.round >= input.maxRounds ? "walk" : "counter";
  }
  if (input.sellerPrice <= input.targetPrice) {
    return "accept";
  }
  if (input.round >= input.maxRounds) {
    return "accept";
  }

  return "counter";
}

export function nextBuyerCounter(input: {
  openingOffer: number;
  maxPrice: number;
  round: number;
  maxRounds: number;
}): number {
  const next =
    input.openingOffer +
    ((input.maxPrice - input.openingOffer) * input.round) / input.maxRounds;

  return roundCurrency(Math.min(input.maxPrice, next));
}

export function decideSellerMove(input: {
  buyerPrice: number;
  listPrice: number;
  minPrice: number;
  round: number;
  maxRounds: number;
}): NegotiationMove {
  if (input.buyerPrice >= input.listPrice) {
    return "accept";
  }
  if (input.buyerPrice >= input.minPrice && input.round >= input.maxRounds) {
    return "accept";
  }
  if (input.buyerPrice < input.minPrice && input.round >= input.maxRounds) {
    return "walk";
  }

  return "counter";
}

export function nextSellerCounter(input: {
  listPrice: number;
  minPrice: number;
  round: number;
  maxRounds: number;
}): number {
  const next =
    input.listPrice -
    ((input.listPrice - input.minPrice) * input.round) / input.maxRounds;

  return roundCurrency(Math.max(input.minPrice, next));
}

export function sellerCounterPrice(policy: SellerPolicy, round: number): number {
  return nextSellerCounter({
    listPrice: policy.list_price,
    minPrice: policy.min_price,
    round,
    maxRounds: policy.max_rounds
  });
}
