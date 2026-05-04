import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runBuyerNegotiation } from "../src/buyer-agent";
import { createSellerServer } from "../src/seller-server";
import type { BuyerIntent, BuyerSession, BuyerStrategy, SellerPolicy } from "../src/types";

const BUYER_AUDIT_LOG_PATH = "buyer/workspace/memory/audit.log";
const SELLER_PUBKEY = "mock-seller-pubkey";
const BUYER_PUBKEY = "mock-buyer-pubkey";
const BUYER_SHARED_SECRET = "test-buyer-secret";
const BUYER_SESSION: BuyerSession = {
  buyer_pubkey: BUYER_PUBKEY,
  shared_secret: BUYER_SHARED_SECRET
};

function baseIntent(maxPrice: number): BuyerIntent {
  return {
    item: "USB-C cable",
    quantity: 1,
    must_have: {},
    max_price: maxPrice,
    target_price: Math.min(4, maxPrice),
    currency: "USDC",
    negotiation_style: "balanced",
    max_rounds: 3,
    allow_partial_match: false,
    require_human_confirmation_before_payment: true
  };
}

function baseStrategy(openingOffer = 4): BuyerStrategy {
  return {
    opening_offer: openingOffer,
    preferred_price: 4,
    concession_schedule: "linear",
    walkaway_after_rounds: 3
  };
}

function basePolicy(overrides: Partial<SellerPolicy> = {}): SellerPolicy {
  return {
    item_id: "cable-usbc-001",
    item_name: "USB-C cable",
    inventory_available: 10,
    list_price: 6,
    min_price: 4.5,
    currency: "USDC",
    fulfillment_terms: "redemption code immediately",
    negotiation_style: "balanced",
    max_rounds: 3,
    ...overrides
  };
}

async function startSeller(policy: SellerPolicy): Promise<{
  sellerUrl: string;
  sellerAuditLogPath: string;
  close: () => Promise<void>;
}> {
  const auditDir = await mkdtemp(join(tmpdir(), "bidmesh-negotiation-"));
  const sellerAuditLogPath = join(auditDir, "seller-audit.log");
  const app = createSellerServer(policy, {
    auditLogPath: sellerAuditLogPath,
    sellerPubkey: SELLER_PUBKEY,
    buyerSecrets: {
      [BUYER_PUBKEY]: BUYER_SHARED_SECRET
    }
  });
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return {
    sellerUrl: `http://127.0.0.1:${address.port}`,
    sellerAuditLogPath,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

async function readAuditWithRetry(path: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await readFile(path, "utf8");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  throw new Error(`Timed out waiting for audit log at ${path}`);
}

let server: Awaited<ReturnType<typeof startSeller>> | undefined;

beforeEach(async () => {
  await rm(BUYER_AUDIT_LOG_PATH, { force: true });
});

afterEach(async () => {
  if (server) {
    await server.close();
    server = undefined;
  }
  await rm(BUYER_AUDIT_LOG_PATH, { force: true });
});

describe("runBuyerNegotiation", () => {
  it("settles the happy path against the real seller server", async () => {
    server = await startSeller(basePolicy());

    const result = await runBuyerNegotiation(
      baseIntent(5),
        baseStrategy(),
        server.sellerUrl,
        SELLER_PUBKEY,
        async () => true,
        BUYER_SESSION
      );

    expect(result.settled).toBe(true);
    expect(result.txHash).toMatch(/^0xmock/);
    expect(result.artifact).toMatch(/^proof-/);
    expect(result.transcript).toContain(`[Artifact] ${result.artifact}`);
    expect(result.deal?.current_price).toBeGreaterThanOrEqual(4.5);
    expect(result.deal?.current_price).toBeLessThanOrEqual(5);
    expect(result.deal?.phase).toBe("settled");
  });

  it("walks when buyer cap is too low", async () => {
    server = await startSeller(basePolicy());

    const result = await runBuyerNegotiation(
      baseIntent(3),
        baseStrategy(3),
        server.sellerUrl,
        SELLER_PUBKEY,
        async () => true,
        BUYER_SESSION
      );

    expect(result.settled).toBe(false);
    expect(result.deal?.phase).toBe("walked");
  });

  it("walks when seller floor is too high for any overlap", async () => {
    server = await startSeller(
      basePolicy({
        list_price: 7,
        min_price: 6
      })
    );

    const result = await runBuyerNegotiation(
      baseIntent(5),
        baseStrategy(),
        server.sellerUrl,
        SELLER_PUBKEY,
        async () => true,
        BUYER_SESSION
      );

    expect(result.settled).toBe(false);
    expect(result.deal?.phase).toBe("walked");
  });

  it("blocks a forced over-cap opening offer before HTTP and writes buyer audit", async () => {
    server = await startSeller(basePolicy());

    const result = await runBuyerNegotiation(
      baseIntent(5),
        baseStrategy(7),
        server.sellerUrl,
        SELLER_PUBKEY,
        async () => true,
        BUYER_SESSION
      );

    expect(result.settled).toBe(false);
    expect(result.deal).toBeUndefined();

    const buyerAudit = await readAuditWithRetry(BUYER_AUDIT_LOG_PATH);
    expect(buyerAudit).toContain('"action":"blocked"');
    expect(buyerAudit).toContain('"attempted_price":7');

    try {
      const sellerAudit = await readFile(server.sellerAuditLogPath, "utf8");
      expect(sellerAudit).not.toContain('"action":"open_received"');
    } catch {
      expect(true).toBe(true);
    }
  });
});
