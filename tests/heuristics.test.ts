import { describe, expect, it } from "vitest";
import {
  decideBuyerMove,
  decideSellerMove,
  defaultBuyerStrategy,
  nextBuyerCounter,
  nextSellerCounter,
  sellerCounterPrice
} from "../src/heuristics";
import type { BuyerIntent, SellerPolicy } from "../src/types";

const buyerIntent: BuyerIntent = {
  item: "USB-C cable",
  quantity: 1,
  must_have: {},
  max_price: 5,
  target_price: 8,
  currency: "USDC",
  negotiation_style: "balanced",
  max_rounds: 3,
  allow_partial_match: false,
  require_human_confirmation_before_payment: true
};

const sellerPolicy: SellerPolicy = {
  item_id: "cable-usbc-001",
  item_name: "USB-C cable",
  inventory_available: 10,
  list_price: 6,
  min_price: 4.5,
  currency: "USDC",
  fulfillment_terms: "redemption code immediately",
  negotiation_style: "balanced",
  max_rounds: 3
};

describe("seller heuristics", () => {
  it("clamps buyer preferred price to the cap", () => {
    expect(defaultBuyerStrategy(buyerIntent)).toMatchObject({
      opening_offer: 5,
      preferred_price: 5
    });
  });

  it("never accepts above the buyer cap", () => {
    expect(
      decideBuyerMove({
        sellerPrice: 7,
        targetPrice: 8,
        maxPrice: 5,
        round: 1,
        maxRounds: 3
      })
    ).toBe("counter");
    expect(
      decideBuyerMove({
        sellerPrice: 7,
        targetPrice: 8,
        maxPrice: 5,
        round: 3,
        maxRounds: 3
      })
    ).toBe("walk");
  });

  it("keeps buyer counters monotonic and capped", () => {
    expect(nextBuyerCounter({ openingOffer: 4, maxPrice: 5, round: 1, maxRounds: 3 })).toBe(
      4.33
    );
    expect(nextBuyerCounter({ openingOffer: 4, maxPrice: 5, round: 3, maxRounds: 3 })).toBe(5);
  });

  it("counters above the floor before the last round", () => {
    expect(
      decideSellerMove({
        buyerPrice: 4,
        listPrice: 6,
        minPrice: 4.5,
        round: 1,
        maxRounds: 3
      })
    ).toBe("counter");
    expect(nextSellerCounter({ listPrice: 6, minPrice: 4.5, round: 1, maxRounds: 3 })).toBe(
      5.5
    );
  });

  it("walks after the round limit when the buyer remains below the floor", () => {
    expect(
      decideSellerMove({
        buyerPrice: 4,
        listPrice: 6,
        minPrice: 4.5,
        round: 3,
        maxRounds: 3
      })
    ).toBe("walk");
  });

  it("never produces a counter below the floor", () => {
    expect(sellerCounterPrice(sellerPolicy, 4)).toBe(4.5);
  });
});
