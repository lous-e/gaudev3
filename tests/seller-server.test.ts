import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockAuthToken } from "../src/protocol-security";
import { createSellerServer } from "../src/seller-server";
import type {
  AcceptRequest,
  CounterRequest,
  OpenRequest,
  SellerPolicy,
  StatusRequest,
  WalkRequest
} from "../src/types";

type RpcBody = OpenRequest | CounterRequest | AcceptRequest | WalkRequest | StatusRequest;

const sellerPolicy: SellerPolicy = {
  item_id: "cable-usbc-001",
  item_name: "USB-C cable",
  inventory_available: 2,
  list_price: 6,
  min_price: 4.5,
  currency: "USDC",
  fulfillment_terms: "redemption code immediately",
  negotiation_style: "balanced",
  max_rounds: 3
};

const buyerSecrets = {
  "buyer-pubkey": "buyer-secret",
  "second-buyer": "second-secret"
} as const;

let auditDir: string;
let auditLogPath: string;
let currentTime: string;

beforeEach(async () => {
  auditDir = await mkdtemp(join(tmpdir(), "bidmesh-"));
  auditLogPath = join(auditDir, "audit.log");
  currentTime = "2026-05-04T12:00:00.000Z";
});

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(new Date(timestamp).getTime() + minutes * 60_000).toISOString();
}

function createApp(policy: SellerPolicy = sellerPolicy) {
  return createSellerServer(policy, {
    auditLogPath,
    sellerPubkey: "seller-pubkey",
    buyerSecrets: { ...buyerSecrets },
    supportedConstraints: { color: "black" },
    now: () => currentTime,
    maxClockSkewMs: 60_000
  });
}

function signedEnvelope<TBody extends RpcBody>(
  method:
    | "bidmesh.negotiate.open"
    | "bidmesh.negotiate.counter"
    | "bidmesh.negotiate.accept"
    | "bidmesh.negotiate.walk"
    | "bidmesh.negotiate.status",
  body: TBody,
  options: {
    dealId?: string;
    round?: number;
    fromPubkey?: keyof typeof buyerSecrets;
    toPubkey?: string;
    timestamp?: string;
    expiresAt?: string;
  } = {}
) {
  const timestamp = options.timestamp ?? currentTime;
  const envelope = {
    protocol: "nuff/v1" as const,
    method,
    deal_id: options.dealId,
    from_pubkey: options.fromPubkey ?? "buyer-pubkey",
    to_pubkey: options.toPubkey ?? "seller-pubkey",
    round: options.round ?? 1,
    timestamp,
    expires_at: options.expiresAt ?? addMinutes(timestamp, 5),
    body
  };

  return {
    ...envelope,
    signature: "mock" as const,
    authToken: createMockAuthToken(
      envelope,
      buyerSecrets[options.fromPubkey ?? "buyer-pubkey"]
    )
  };
}

function postRpc(app: ReturnType<typeof createApp>, envelope: ReturnType<typeof signedEnvelope<RpcBody>>) {
  return request(app)
    .post("/rpc")
    .set("x-bidmesh-auth", envelope.authToken)
    .send({
      protocol: envelope.protocol,
      method: envelope.method,
      deal_id: envelope.deal_id,
      from_pubkey: envelope.from_pubkey,
      to_pubkey: envelope.to_pubkey,
      round: envelope.round,
      timestamp: envelope.timestamp,
      expires_at: envelope.expires_at,
      signature: envelope.signature,
      body: envelope.body
    });
}

async function openDeal(
  app: ReturnType<typeof createApp>,
  overrides: Partial<{
    fromPubkey: keyof typeof buyerSecrets;
    constraints: Record<string, string>;
    deadline: string;
  }> = {}
) {
  return postRpc(
    app,
    signedEnvelope(
      "bidmesh.negotiate.open",
      {
        intent_summary: "Need a cable",
        item: "USB-C cable",
        quantity: 1,
        constraints: overrides.constraints ?? { color: "black" },
        initial_offer: 4,
        currency: "USDC",
        deadline: overrides.deadline
      },
      {
        fromPubkey: overrides.fromPubkey
      }
    )
  );
}

describe("seller server", () => {
  it("blocks spoofed buyers", async () => {
    const app = createApp();
    const envelope = signedEnvelope("bidmesh.negotiate.open", {
      intent_summary: "Need a cable",
      item: "USB-C cable",
      quantity: 1,
      constraints: { color: "black" },
      initial_offer: 4,
      currency: "USDC"
    });

    const response = await request(app)
      .post("/rpc")
      .set("x-bidmesh-auth", envelope.authToken)
      .send({
        protocol: envelope.protocol,
        method: envelope.method,
        deal_id: envelope.deal_id,
        from_pubkey: "unknown-buyer",
        to_pubkey: envelope.to_pubkey,
        round: envelope.round,
        timestamp: envelope.timestamp,
        expires_at: envelope.expires_at,
        signature: envelope.signature,
        body: envelope.body
      });

    expect(response.body.reason_code).toBe("validation_denied");
  });

  it("blocks replayed envelopes", async () => {
    const app = createApp();
    const envelope = signedEnvelope("bidmesh.negotiate.open", {
      intent_summary: "Need a cable",
      item: "USB-C cable",
      quantity: 1,
      constraints: { color: "black" },
      initial_offer: 4,
      currency: "USDC"
    });

    const first = await postRpc(app, envelope);
    const replay = await postRpc(app, envelope);

    expect(first.body.counter_price).toBe(5.5);
    expect(replay.body.reason_code).toBe("replay_detected");
  });

  it("blocks quantity above inventory on open", async () => {
    const app = createApp();

    const response = await postRpc(
      app,
      signedEnvelope("bidmesh.negotiate.open", {
        intent_summary: "Need cables",
        item: "USB-C cable",
        quantity: 3,
        constraints: { color: "black" },
        initial_offer: 5,
        currency: "USDC"
      })
    );

    expect(response.body.reason_code).toBe("inventory_unavailable");
  });

  it("blocks forged rounds on open", async () => {
    const app = createApp();

    const response = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.open",
        {
          intent_summary: "Need a cable",
          item: "USB-C cable",
          quantity: 1,
          constraints: { color: "black" },
          initial_offer: 4,
          currency: "USDC"
        },
        { round: 3 }
      )
    );

    expect(response.body.reason_code).toBe("validation_denied");
  });

  it("blocks spoofed follow-up callers", async () => {
    const app = createApp();
    const open = await openDeal(app);

    const response = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.counter",
        {
          deal_id: open.body.deal_id,
          price: 4.75,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        {
          dealId: open.body.deal_id,
          round: 2,
          fromPubkey: "second-buyer"
        }
      )
    );

    expect(response.body.reason_code).toBe("validation_denied");
  });

  it("blocks accept with a price that does not match the seller quote", async () => {
    const app = createApp();
    const open = await openDeal(app);

    const accept = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.accept",
        {
          deal_id: open.body.deal_id,
          accepted_price: 4.75,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        {
          dealId: open.body.deal_id,
          round: 2
        }
      )
    );

    expect(accept.body.reason_code).toBe("validation_denied");
  });

  it("rejects unsupported constraints", async () => {
    const app = createApp();
    const open = await openDeal(app, {
      constraints: { color: "red" }
    });

    expect(open.body.reason_code).toBe("validation_denied");
  });

  it("walks cleanly when there is no price overlap", async () => {
    const app = createApp();
    const open = await openDeal(app);

    const counterOne = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.counter",
        {
          deal_id: open.body.deal_id,
          price: 2,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: open.body.deal_id, round: 2 }
      )
    );

    const counterTwo = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.counter",
        {
          deal_id: open.body.deal_id,
          price: 3,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: open.body.deal_id, round: 3 }
      )
    );

    expect(counterOne.body.counter_price).toBe(5);
    expect(counterTwo.body.reason_code).toBe("price_too_low");
  });

  it("enforces buyer deadlines during settlement", async () => {
    const app = createApp();
    const open = await openDeal(app, {
      deadline: addMinutes(currentTime, 2)
    });

    await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.counter",
        {
          deal_id: open.body.deal_id,
          price: 4.75,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: open.body.deal_id, round: 2 }
      )
    );

    await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.accept",
        {
          deal_id: open.body.deal_id,
          accepted_price: 5,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: open.body.deal_id, round: 3 }
      )
    );

    currentTime = addMinutes(currentTime, 3);
    const settle = await request(app).post(`/settle/${open.body.deal_id}`).send({
      accepted_price: 5,
      currency: "USDC",
      buyer_pubkey: "buyer-pubkey",
      human_confirmation: true
    });

    expect(settle.body.closed).toBe(true);
  });

  it("enforces payment challenge expiry", async () => {
    const app = createApp();
    const open = await openDeal(app);

    await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.counter",
        {
          deal_id: open.body.deal_id,
          price: 4.75,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: open.body.deal_id, round: 2 }
      )
    );

    await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.accept",
        {
          deal_id: open.body.deal_id,
          accepted_price: 5,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: open.body.deal_id, round: 3 }
      )
    );

    currentTime = addMinutes(currentTime, 11);
    const settle = await request(app).post(`/settle/${open.body.deal_id}`).send({
      accepted_price: 5,
      currency: "USDC",
      buyer_pubkey: "buyer-pubkey",
      human_confirmation: true
    });

    expect(settle.body.closed).toBe(true);
  });

  it("prevents overselling reserved inventory", async () => {
    const constrainedPolicy: SellerPolicy = {
      ...sellerPolicy,
      inventory_available: 1
    };
    const app = createApp(constrainedPolicy);
    const firstOpen = await openDeal(app);
    const secondOpen = await openDeal(app, { fromPubkey: "second-buyer" });

    await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.counter",
        {
          deal_id: firstOpen.body.deal_id,
          price: 4.75,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: firstOpen.body.deal_id, round: 2 }
      )
    );

    const firstAccept = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.accept",
        {
          deal_id: firstOpen.body.deal_id,
          accepted_price: 5,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: firstOpen.body.deal_id, round: 3 }
      )
    );

    const secondCounter = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.counter",
        {
          deal_id: secondOpen.body.deal_id,
          price: 4.75,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: secondOpen.body.deal_id, round: 2, fromPubkey: "second-buyer" }
      )
    );

    expect(firstAccept.body.accepted).toBe(true);
    expect(secondCounter.body.reason_code).toBe("inventory_unavailable");
  });

  it("settles the happy path and writes richer audit events", async () => {
    const app = createApp();
    const open = await openDeal(app);

    expect(open.body.counter_price).toBe(5.5);

    const counter = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.counter",
        {
          deal_id: open.body.deal_id,
          price: 4.75,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: open.body.deal_id, round: 2 }
      )
    );

    expect(counter.body.counter_price).toBe(5);

    const accept = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.accept",
        {
          deal_id: open.body.deal_id,
          accepted_price: 5,
          currency: "USDC",
          terms: "redemption code immediately"
        },
        { dealId: open.body.deal_id, round: 3 }
      )
    );

    expect(accept.body.accepted).toBe(true);

    const settle = await request(app).post(`/settle/${open.body.deal_id}`).send({
      accepted_price: 5,
      currency: "USDC",
      buyer_pubkey: "buyer-pubkey",
      human_confirmation: true
    });

    expect(settle.body.settled).toBe(true);

    const auditLog = await readFile(auditLogPath, "utf8");
    expect(auditLog).toContain('"action":"open_received"');
    expect(auditLog).toContain('"action":"seller_countered"');
    expect(auditLog).toContain('"action":"buyer_accepted_quote"');
    expect(auditLog).toContain('"action":"settled"');
    expect(auditLog).toContain('"request_fingerprint"');
  });

  it("returns structured status responses", async () => {
    const app = createApp();
    const open = await openDeal(app);

    const status = await postRpc(
      app,
      signedEnvelope(
        "bidmesh.negotiate.status",
        { deal_id: open.body.deal_id },
        { dealId: open.body.deal_id, round: 2 }
      )
    );

    expect(status.status).toBe(200);
    expect(status.body.deal_id).toBe(open.body.deal_id);
    expect(status.body.phase).toBe("countering");
  });
});
