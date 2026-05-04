import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createMockAuthToken } from "../src/protocol-security";
import { createSellerServer } from "../src/seller-server";
import type { OpenRequest, SellerPolicy, StatusRequest } from "../src/types";

const stressPolicy: SellerPolicy = {
  item_id: "cable-usbc-001",
  item_name: "USB-C cable",
  inventory_available: 500,
  list_price: 6,
  min_price: 4.5,
  currency: "USDC",
  fulfillment_terms: "redemption code immediately",
  negotiation_style: "balanced",
  max_rounds: 3
};

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(new Date(timestamp).getTime() + minutes * 60_000).toISOString();
}

describe("stress and adversarial coverage", () => {
  it("holds up under burst open traffic and replay attempts", async () => {
    const auditDir = await mkdtemp(join(tmpdir(), "bidmesh-stress-"));
    const auditLogPath = join(auditDir, "audit.log");
    let currentTime = "2026-05-04T12:00:00.000Z";

    const buyerSecrets = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`buyer-${index}`, `secret-${index}`])
    );

    const app = createSellerServer(stressPolicy, {
      auditLogPath,
      sellerPubkey: "seller-pubkey",
      buyerSecrets,
      supportedConstraints: { color: "black" },
      now: () => currentTime,
      maxClockSkewMs: 60_000,
      maxActiveDeals: 200
    });

    function signedOpenEnvelope(buyer: string, body: OpenRequest) {
      const envelope = {
        protocol: "nuff/v1" as const,
        method: "bidmesh.negotiate.open" as const,
        deal_id: undefined,
        from_pubkey: buyer,
        to_pubkey: "seller-pubkey",
        round: 1,
        timestamp: currentTime,
        expires_at: addMinutes(currentTime, 5),
        body
      };

      return {
        ...envelope,
        signature: "mock" as const,
        authToken: createMockAuthToken(envelope, buyerSecrets[buyer])
      };
    }

    const opens = await Promise.all(
      Object.keys(buyerSecrets).map((buyer, index) =>
        request(app)
          .post("/rpc")
          .set(
            "x-bidmesh-auth",
            signedOpenEnvelope(buyer, {
              intent_summary: `Need cable ${index}`,
              item: "USB-C cable",
              quantity: 1,
              constraints: { color: "black" },
              initial_offer: 4,
              currency: "USDC"
            }).authToken
          )
          .send({
            ...signedOpenEnvelope(buyer, {
              intent_summary: `Need cable ${index}`,
              item: "USB-C cable",
              quantity: 1,
              constraints: { color: "black" },
              initial_offer: 4,
              currency: "USDC"
            }),
            authToken: undefined
          })
      )
    );

    expect(opens.filter((response) => response.body.deal_id).length).toBe(60);
    expect(opens.every((response) => response.status === 200)).toBe(true);

    const replayEnvelope = signedOpenEnvelope("buyer-0", {
      intent_summary: "Need cable replay",
      item: "USB-C cable",
      quantity: 1,
      constraints: { color: "black" },
      initial_offer: 4,
      currency: "USDC"
    });

    const firstReplay = await request(app)
      .post("/rpc")
      .set("x-bidmesh-auth", replayEnvelope.authToken)
      .send({ ...replayEnvelope, authToken: undefined });
    const secondReplay = await request(app)
      .post("/rpc")
      .set("x-bidmesh-auth", replayEnvelope.authToken)
      .send({ ...replayEnvelope, authToken: undefined });

    expect(firstReplay.status).toBe(200);
    expect(secondReplay.body.reason_code).toBe("replay_detected");

    currentTime = addMinutes(currentTime, 1);
    const auditLog = await readFile(auditLogPath, "utf8");
    expect(auditLog.split("\n").filter(Boolean).length).toBeGreaterThanOrEqual(62);
  }, 15000);

  it("rejects an invalid-open flood without creating usable deal state", async () => {
    const auditDir = await mkdtemp(join(tmpdir(), "bidmesh-flood-"));
    const auditLogPath = join(auditDir, "audit.log");
    const currentTime = "2026-05-04T12:00:00.000Z";
    const buyerSecrets = { "buyer-pubkey": "buyer-secret" };

    const app = createSellerServer(stressPolicy, {
      auditLogPath,
      sellerPubkey: "seller-pubkey",
      buyerSecrets,
      supportedConstraints: { color: "black" },
      now: () => currentTime,
      maxClockSkewMs: 60_000,
      maxActiveDeals: 50
    });

    function signedInvalidOpen(index: number) {
      const envelope = {
        protocol: "nuff/v1" as const,
        method: "bidmesh.negotiate.open" as const,
        deal_id: undefined,
        from_pubkey: "buyer-pubkey",
        to_pubkey: "wrong-seller",
        round: 1,
        timestamp: currentTime,
        expires_at: addMinutes(currentTime, 5),
        body: {
          intent_summary: `bad-${index}`,
          item: "USB-C cable",
          quantity: 1,
          constraints: { color: "black" },
          initial_offer: 4,
          currency: "USDC" as const
        }
      };

      return {
        ...envelope,
        signature: "mock" as const,
        authToken: createMockAuthToken(envelope, buyerSecrets["buyer-pubkey"])
      };
    }

    const invalidResponses = await Promise.all(
      Array.from({ length: 40 }, (_, index) => {
        const envelope = signedInvalidOpen(index);
        return request(app)
          .post("/rpc")
          .set("x-bidmesh-auth", envelope.authToken)
          .send({ ...envelope, authToken: undefined });
      })
    );

    expect(
      invalidResponses.every((response) => response.body.reason_code === "validation_denied")
    ).toBe(true);

    const statusEnvelope = {
      protocol: "nuff/v1" as const,
      method: "bidmesh.negotiate.status" as const,
      deal_id: invalidResponses[0].body.deal_id,
      from_pubkey: "buyer-pubkey",
      to_pubkey: "seller-pubkey",
      round: 2,
      timestamp: currentTime,
      expires_at: addMinutes(currentTime, 5),
      body: {
        deal_id: invalidResponses[0].body.deal_id
      } satisfies StatusRequest
    };

    const nonexistentStatus = await request(app)
      .post("/rpc")
      .set("x-bidmesh-auth", createMockAuthToken(statusEnvelope, buyerSecrets["buyer-pubkey"]))
      .send({
        ...statusEnvelope,
        signature: "mock"
      });

    expect(nonexistentStatus.status).toBe(200);
    expect(nonexistentStatus.body.phase).toBe("walked");
  });
});
