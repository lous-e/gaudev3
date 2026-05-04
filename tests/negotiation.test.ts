import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AcceptResponse,
  BuyerIntent,
  BuyerStrategy,
  CounterResponse,
  OpenResponse,
  WalkResponse
} from "../src/types";

vi.mock("../src/validation", () => ({
  validateBuyerAction: (
    _action: "open" | "counter" | "accept" | "settle",
    price: number,
    intent: BuyerIntent,
    humanConfirmed: boolean
  ) => {
    if (price > intent.max_price) {
      return { allow: false, reason: "price_exceeds_max_price" };
    }

    if (_action === "settle" && intent.require_human_confirmation_before_payment && !humanConfirmed) {
      return { allow: false, reason: "human_confirmation_required" };
    }

    return { allow: true };
  }
}));

const buyerAuditEntries: unknown[] = [];

vi.mock("../src/audit", () => ({
  writeBuyerAudit: (entry: unknown) => {
    buyerAuditEntries.push(entry);
  }
}));

vi.mock("../src/heuristics", () => ({
  decideBuyerMove: ({
    sellerPrice,
    targetPrice,
    maxPrice,
    round,
    maxRounds
  }: {
    sellerPrice: number;
    targetPrice: number;
    maxPrice: number;
    round: number;
    maxRounds: number;
  }) => {
    if (sellerPrice <= targetPrice) return "accept";
    if (sellerPrice <= maxPrice && round >= maxRounds) return "accept";
    if (sellerPrice > maxPrice && round >= maxRounds) return "walk";
    return "counter";
  },
  nextBuyerCounter: (
    openingOffer: number,
    maxPrice: number,
    round: number,
    maxRounds: number
  ) => Math.min(maxPrice, openingOffer + ((maxPrice - openingOffer) * round) / maxRounds)
}));

async function loadBuyerAgent() {
  return import("../src/buyer-agent");
}

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

type MockSellerOptions = {
  openCounterPrice: number;
  acceptResponse?: "accept" | "walk";
  acceptCounter?: boolean;
};

async function startMockSeller(options: MockSellerOptions): Promise<{
  url: string;
  server: Server;
  requests: Array<{ method?: string; body: Record<string, unknown> }>;
  settled: boolean;
}> {
  const requests: Array<{ method?: string; body: Record<string, unknown> }> = [];
  let settled = false;

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const payload = chunks.length > 0
        ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
        : {};
      requests.push({ method: payload.method, body: payload });

      response.setHeader("content-type", "application/json");

      if (request.url === "/rpc" && request.method === "POST") {
        if (payload.method === "bidmesh.negotiate.open") {
          const body: OpenResponse = {
            deal_id: "deal-1",
            accepted: false,
            counter_price: options.openCounterPrice,
            terms: "redemption code immediately"
          };
          response.end(JSON.stringify(body));
          return;
        }

        if (payload.method === "bidmesh.negotiate.counter") {
          const body: CounterResponse = {
            deal_id: "deal-1",
            accepted: options.acceptCounter ?? true,
            counter_price: options.acceptCounter === false ? options.openCounterPrice : undefined,
            terms: "redemption code immediately"
          };
          response.end(JSON.stringify(body));
          return;
        }

        if (payload.method === "bidmesh.negotiate.accept") {
          if (options.acceptResponse === "walk") {
            const body: WalkResponse = { deal_id: "deal-1", closed: true };
            response.end(JSON.stringify(body));
            return;
          }

          const body: AcceptResponse = {
            deal_id: "deal-1",
            accepted: true,
            settlement_url: `${serverAddress(server)}/settle/deal-1`,
            payment_required: {
              network: "base-sepolia",
              asset: "USDC",
              amount: Number(payload.body.accepted_price),
              pay_to: "0xMOCK_SELLER_WALLET",
              expires_at: new Date(Date.now() + 600000).toISOString()
            }
          };
          response.end(JSON.stringify(body));
          return;
        }

        if (payload.method === "bidmesh.negotiate.walk") {
          const body: WalkResponse = { deal_id: "deal-1", closed: true };
          response.end(JSON.stringify(body));
          return;
        }
      }

      if (request.url === "/settle/deal-1" && request.method === "POST") {
        settled = true;
        response.end(JSON.stringify({
          txHash: "0xMOCKABC123",
          artifact: "redemption-code-ABC123"
        }));
        return;
      }

      response.statusCode = 404;
      response.end(JSON.stringify({ error: "not found" }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  return {
    url: serverAddress(server),
    server,
    requests,
    get settled() {
      return settled;
    }
  };
}

function serverAddress(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server?: Server): Promise<void> {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("runBuyerNegotiation", () => {
  let server: Server | undefined;

  beforeEach(() => {
    buyerAuditEntries.length = 0;
  });

  afterEach(async () => {
    await closeServer(server);
    server = undefined;
    vi.resetModules();
  });

  it("settles a happy path at or below buyer max", async () => {
    const mockSeller = await startMockSeller({ openCounterPrice: 4.75 });
    server = mockSeller.server;
    const { runBuyerNegotiation } = await loadBuyerAgent();

    const result = await runBuyerNegotiation(
      baseIntent(5),
      baseStrategy(),
      mockSeller.url,
      "mock-seller-pubkey",
      async () => true
    );

    expect(result.settled).toBe(true);
    expect(result.txHash).toBe("0xMOCKABC123");
    expect(result.artifact).toBe("redemption-code-ABC123");
    expect(result.transcript).toContain("[Artifact] redemption-code-ABC123");
    expect(result.deal?.current_price).toBeLessThanOrEqual(5);
    expect(mockSeller.settled).toBe(true);
  });

  it("walks when buyer cap is too low", async () => {
    const mockSeller = await startMockSeller({
      openCounterPrice: 4.5,
      acceptCounter: false
    });
    server = mockSeller.server;
    const { runBuyerNegotiation } = await loadBuyerAgent();

    const result = await runBuyerNegotiation(
      baseIntent(3),
      baseStrategy(3),
      mockSeller.url,
      "mock-seller-pubkey",
      async () => true
    );

    expect(result.settled).toBe(false);
    expect(mockSeller.settled).toBe(false);
    expect(mockSeller.requests.some((entry) => entry.method === "bidmesh.negotiate.walk")).toBe(true);
  });

  it("walks when seller floor is too high for any overlap", async () => {
    const mockSeller = await startMockSeller({
      openCounterPrice: 6,
      acceptCounter: false
    });
    server = mockSeller.server;
    const { runBuyerNegotiation } = await loadBuyerAgent();

    const result = await runBuyerNegotiation(
      baseIntent(5),
      baseStrategy(),
      mockSeller.url,
      "mock-seller-pubkey",
      async () => true
    );

    expect(result.settled).toBe(false);
    expect(mockSeller.settled).toBe(false);
    expect(mockSeller.requests.some((entry) => entry.method === "bidmesh.negotiate.walk")).toBe(true);
  });

  it("walks cleanly when seller returns a structured accept denial", async () => {
    const mockSeller = await startMockSeller({
      openCounterPrice: 4.75,
      acceptResponse: "walk"
    });
    server = mockSeller.server;
    const { runBuyerNegotiation } = await loadBuyerAgent();

    const result = await runBuyerNegotiation(
      baseIntent(5),
      baseStrategy(),
      mockSeller.url,
      "mock-seller-pubkey",
      async () => true
    );

    expect(result.settled).toBe(false);
    expect(mockSeller.settled).toBe(false);
  });

  it("blocks a forced over-cap opening offer before sending HTTP", async () => {
    const mockSeller = await startMockSeller({ openCounterPrice: 4.75 });
    server = mockSeller.server;
    const { runBuyerNegotiation } = await loadBuyerAgent();

    const result = await runBuyerNegotiation(
      baseIntent(5),
      baseStrategy(7),
      mockSeller.url,
      "mock-seller-pubkey",
      async () => true
    );

    expect(result.settled).toBe(false);
    expect(mockSeller.requests).toHaveLength(0);
    expect(buyerAuditEntries).toHaveLength(1);
    expect(buyerAuditEntries[0]).toMatchObject({
      action: "blocked",
      attempted_price: 7,
      cap: 5,
      allowed: false
    });
  });

  it("does not settle when human declines confirmation", async () => {
    const mockSeller = await startMockSeller({ openCounterPrice: 4.75 });
    server = mockSeller.server;
    const { runBuyerNegotiation } = await loadBuyerAgent();

    const result = await runBuyerNegotiation(
      baseIntent(5),
      baseStrategy(),
      mockSeller.url,
      "mock-seller-pubkey",
      async () => false
    );

    expect(result.settled).toBe(false);
    expect(mockSeller.settled).toBe(false);
    expect(buyerAuditEntries).toHaveLength(1);
    expect(buyerAuditEntries[0]).toMatchObject({
      action: "blocked",
      reason: "human_confirmation_required"
    });
  });
});
