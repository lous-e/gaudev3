import { describe, expect, it } from "vitest";
import {
  acceptRpcRequestSchema,
  acceptRequestSchema,
  openRequestSchema,
  openResponseSchema,
  openRpcRequestSchema,
  sellerPolicySchema,
  settlementResponseSchema
} from "../src/schemas";

describe("schemas", () => {
  it("rejects invalid currency", () => {
    const result = openRequestSchema.safeParse({
      intent_summary: "Need a cable",
      item: "USB-C cable",
      quantity: 1,
      constraints: {},
      initial_offer: 4,
      currency: "EUR"
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing or negative prices", () => {
    const missing = acceptRequestSchema.safeParse({
      deal_id: "deal-1",
      currency: "USDC",
      terms: "redemption code immediately"
    });
    const negative = openRequestSchema.safeParse({
      intent_summary: "Need a cable",
      item: "USB-C cable",
      quantity: 1,
      constraints: {},
      initial_offer: -1,
      currency: "USDC"
    });

    expect(missing.success).toBe(false);
    expect(negative.success).toBe(false);
  });

  it("rejects unknown method names", () => {
    const result = openRpcRequestSchema.safeParse({
      protocol: "nuff/v1",
      method: "bidmesh.unknown",
      from_pubkey: "buyer",
      to_pubkey: "seller",
      round: 0,
      timestamp: "2026-05-04T12:00:00.000Z",
      signature: "mock",
      body: {
        intent_summary: "Need a cable",
        item: "USB-C cable",
        quantity: 1,
        constraints: {},
        initial_offer: 4,
        currency: "USDC"
      }
    });

    expect(result.success).toBe(false);
  });

  it("parses valid requests cleanly", () => {
    const openResult = openRpcRequestSchema.safeParse({
      protocol: "nuff/v1",
      method: "bidmesh.negotiate.open",
      from_pubkey: "buyer",
      to_pubkey: "seller",
      round: 1,
      timestamp: "2026-05-04T12:00:00.000Z",
      signature: "mock",
      body: {
        intent_summary: "Need a cable",
        item: "USB-C cable",
        quantity: 1,
        constraints: { color: "black" },
        initial_offer: 4,
        currency: "USDC"
      }
    });

    const acceptResult = acceptRpcRequestSchema.safeParse({
      protocol: "nuff/v1",
      method: "bidmesh.negotiate.accept",
      deal_id: "deal-1",
      from_pubkey: "buyer",
      to_pubkey: "seller",
      round: 1,
      timestamp: "2026-05-04T12:00:00.000Z",
      signature: "mock",
      body: {
        deal_id: "deal-1",
        accepted_price: 4.75,
        currency: "USDC",
        terms: "redemption code immediately"
      }
    });

    expect(openResult.success).toBe(true);
    expect(acceptResult.success).toBe(true);
  });

  it("rejects mismatched method/body schemas and deal identifiers", () => {
    const badMethod = openRpcRequestSchema.safeParse({
      protocol: "nuff/v1",
      method: "bidmesh.negotiate.open",
      from_pubkey: "buyer",
      to_pubkey: "seller",
      round: 1,
      timestamp: "2026-05-04T12:00:00.000Z",
      signature: "mock",
      body: {
        deal_id: "deal-1",
        accepted_price: 4.75,
        currency: "USDC",
        terms: "redemption code immediately"
      }
    });
    const badDealId = acceptRpcRequestSchema.safeParse({
      protocol: "nuff/v1",
      method: "bidmesh.negotiate.accept",
      deal_id: "deal-1",
      from_pubkey: "buyer",
      to_pubkey: "seller",
      round: 1,
      timestamp: "2026-05-04T12:00:00.000Z",
      signature: "mock",
      body: {
        deal_id: "deal-2",
        accepted_price: 4.75,
        currency: "USDC",
        terms: "redemption code immediately"
      }
    });

    expect(badMethod.success).toBe(false);
    expect(badDealId.success).toBe(false);
  });

  it("rejects contradictory response payloads", () => {
    const result = openResponseSchema.safeParse({
      deal_id: "deal-1",
      accepted: true,
      price: 4.75,
      counter_price: 5
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid seller policy price ordering", () => {
    const result = sellerPolicySchema.safeParse({
      item_id: "cable-usbc-001",
      item_name: "USB-C cable",
      inventory_available: 10,
      list_price: 4,
      min_price: 4.5,
      currency: "USDC",
      fulfillment_terms: "redemption code immediately",
      negotiation_style: "balanced",
      max_rounds: 3
    });

    expect(result.success).toBe(false);
  });

  it("requires proof_artifact for settlement responses", () => {
    const result = settlementResponseSchema.safeParse({
      deal_id: "deal-1",
      settled: true,
      tx_hash: "0xmock1234"
    });

    expect(result.success).toBe(false);
  });
});
