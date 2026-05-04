import { describe, expect, it } from "vitest";
import { buyerIntentSchema } from "../src/schemas";
import { validateBuyerAction, validateSellerAction } from "../src/validation";
import type { BuyerIntent, SellerPolicy } from "../src/types";

const buyerIntent: BuyerIntent = {
  item: "USB-C cable",
  quantity: 1,
  must_have: {},
  max_price: 5,
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

describe("validateBuyerAction", () => {
  it("blocks an opening offer above the buyer cap", () => {
    expect(validateBuyerAction({ type: "open", price: 6 }, buyerIntent)).toEqual({
      allow: false,
      reason: "opening_offer_exceeds_max_price"
    });
  });

  it("blocks a counter above the buyer cap", () => {
    expect(validateBuyerAction({ type: "counter", price: 7 }, buyerIntent)).toEqual({
      allow: false,
      reason: "counter_offer_exceeds_max_price"
    });
  });

  it("blocks settlement without human confirmation", () => {
    expect(
      validateBuyerAction(
        {
          type: "settle",
          amount: 4.75,
          accepted_price: 4.75,
          human_confirmation: false
        },
        buyerIntent
      )
    ).toEqual({
      allow: false,
      reason: "human_confirmation_missing"
    });
  });

  it("rejects buyer intents with target_price above max_price", () => {
    const result = buyerIntentSchema.safeParse({
      ...buyerIntent,
      target_price: 7
    });

    expect(result.success).toBe(false);
  });
});

describe("validateSellerAction", () => {
  it("blocks acceptance below seller minimum price", () => {
    expect(
      validateSellerAction(
        {
          type: "accept",
          quantity: 1,
          currency: "USDC",
          accepted_price: 4
        },
        sellerPolicy
      )
    ).toEqual({
      allow: false,
      reason: "below_min_price"
    });
  });

  it("blocks quantity above inventory", () => {
    expect(
      validateSellerAction(
        {
          type: "accept",
          quantity: 11,
          currency: "USDC",
          accepted_price: 5
        },
        sellerPolicy
      )
    ).toEqual({
      allow: false,
      reason: "inventory_unavailable"
    });
  });

  it("blocks invalid non-positive quantities", () => {
    expect(
      validateSellerAction(
        {
          type: "accept",
          quantity: 0,
          currency: "USDC",
          accepted_price: 5
        },
        sellerPolicy
      )
    ).toEqual({
      allow: false,
      reason: "invalid_quantity"
    });
  });

  it("allows the fixed MVP USDC currency", () => {
    expect(
      validateSellerAction(
        {
          type: "accept",
          quantity: 1,
          currency: "USDC",
          accepted_price: 5
        },
        sellerPolicy
      )
    ).toEqual({
      allow: true
    });
  });

  it("blocks malformed reservation timestamps", () => {
    expect(
      validateSellerAction(
        {
          type: "settle",
          quantity: 1,
          currency: "USDC",
          accepted_price: 5,
          now: "not-a-date"
        },
        {
          ...sellerPolicy,
          reservation_deadline: "2026-05-04T12:05:00.000Z"
        }
      )
    ).toEqual({
      allow: false,
      reason: "reservation_expired"
    });
  });
});
