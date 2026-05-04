// Developer 1 owns this file. Stub only — do not implement.

export function decideBuyerMove(_params: {
  sellerPrice: number;
  targetPrice: number;
  maxPrice: number;
  round: number;
  maxRounds: number;
}): "accept" | "counter" | "walk" {
  throw new Error("heuristics.ts: not implemented by Developer 1 yet");
}

export function nextBuyerCounter(
  _openingOffer: number,
  _maxPrice: number,
  _round: number,
  _maxRounds: number
): number {
  throw new Error("heuristics.ts: not implemented by Developer 1 yet");
}

export function decideSellerMove(_params: {
  buyerPrice: number;
  listPrice: number;
  minPrice: number;
  round: number;
  maxRounds: number;
}): "accept" | "counter" | "walk" {
  throw new Error("heuristics.ts: not implemented by Developer 1 yet");
}

export function nextSellerCounter(
  _listPrice: number,
  _minPrice: number,
  _round: number,
  _maxRounds: number
): number {
  throw new Error("heuristics.ts: not implemented by Developer 1 yet");
}
