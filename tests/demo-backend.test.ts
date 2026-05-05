import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoBackendApp } from "../src/demo-backend/server";
import type { BuyerIntent } from "../src/types";

function baseIntent(maxPrice = 5): BuyerIntent {
  return {
    item: "USB-C cable",
    quantity: 1,
    must_have: { length_m: 1 },
    max_price: maxPrice,
    target_price: Math.min(4, maxPrice),
    currency: "USDC",
    negotiation_style: "balanced",
    max_rounds: 3,
    allow_partial_match: false,
    require_human_confirmation_before_payment: true
  };
}

async function startApp(): Promise<{ url: string; server: Server }> {
  const server = createServer(createDemoBackendApp());

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address.");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    server
  };
}

async function closeServer(server?: Server): Promise<void> {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function postJson<TResponse>(
  url: string,
  body?: unknown
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  expect(response.ok).toBe(true);
  return await response.json() as TResponse;
}

async function getJson<TResponse>(url: string): Promise<TResponse> {
  const response = await fetch(url);

  expect(response.ok).toBe(true);
  return await response.json() as TResponse;
}

async function waitForEvent(
  baseUrl: string,
  dealId: string,
  kind: string
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 1000;

  while (Date.now() < deadline) {
    const deal = await getJson<{ events: Array<Record<string, unknown>> }>(
      `${baseUrl}/api/deals/${dealId}`
    );
    const event = deal.events.find((candidate) => candidate.kind === kind);

    if (event) return event;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Timed out waiting for ${kind}.`);
}

async function readSseReplay(
  baseUrl: string,
  eventsUrl: string
): Promise<string> {
  const abort = new AbortController();
  const response = await fetch(`${baseUrl}${eventsUrl}`, {
    signal: abort.signal
  });
  const reader = response.body?.getReader();

  if (!reader) throw new Error("Expected SSE response body.");

  let text = "";
  const deadline = Date.now() + 1000;

  while (Date.now() < deadline && !text.includes("marketplace.selected")) {
    const chunk = await reader.read();

    if (chunk.done) break;
    text += Buffer.from(chunk.value).toString("utf8");
  }

  abort.abort();
  return text;
}

describe("demo backend", () => {
  let server: Server | undefined;

  afterEach(async () => {
    await closeServer(server);
    server = undefined;
  });

  it("returns seeded protocol-compatible sellers", async () => {
    const app = await startApp();
    server = app.server;

    const body = await getJson<{ sellers: Array<Record<string, unknown>> }>(
      `${app.url}/api/marketplace/sellers`
    );

    expect(body.sellers.length).toBeGreaterThanOrEqual(5);
    expect(body.sellers[0]).toMatchObject({
      id: "seller-usbc-balanced",
      handle: "cableworks.agent",
      endpoint: "https://cableworks.agent/rpc"
    });
    expect(body.sellers[0].policy).toMatchObject({
      currency: "USDC",
      item_name: "USB-C cable"
    });
  });

  it("lists created deals through the backend index endpoint", async () => {
    const app = await startApp();
    server = app.server;

    const created = await postJson<{ deal_id: string }>(`${app.url}/api/deals`, {
      seller_id: "seller-usbc-balanced",
      intent: baseIntent()
    });

    await waitForEvent(app.url, created.deal_id, "marketplace.selected");

    const listed = await getJson<{ deals: Array<Record<string, unknown>> }>(
      `${app.url}/api/deals`
    );

    expect(listed.deals.length).toBeGreaterThanOrEqual(1);
    expect(listed.deals[0]).toMatchObject({
      deal_id: created.deal_id,
      seller: { id: "seller-usbc-balanced" }
    });
  });

  it("searches all matching sellers by default and records the market scan", async () => {
    const app = await startApp();
    server = app.server;

    const created = await postJson<{ deal_id: string }>(`${app.url}/api/deals`, {
      intent: baseIntent()
    });
    await waitForEvent(app.url, created.deal_id, "marketplace.selection_finalized");

    const deal = await getJson<{
      seller: { id: string };
      market_scan: {
        searched_count: number;
        candidates: Array<{ seller_id: string; status: string }>;
        selected_seller_id: string;
      };
    }>(`${app.url}/api/deals/${created.deal_id}`);

    expect(deal.market_scan.searched_count).toBeGreaterThanOrEqual(5);
    expect(deal.market_scan.candidates.length).toBeGreaterThanOrEqual(5);
    expect(deal.market_scan.selected_seller_id).toBe(deal.seller.id);
    expect(deal.market_scan.candidates.some((candidate) => candidate.status === "selected")).toBe(true);
  });

  it("serves the imported human and agent UI kits", async () => {
    const app = await startApp();
    server = app.server;

    const human = await fetch(`${app.url}/ui/human`);
    const agent = await fetch(`${app.url}/ui/agent`);

    expect(human.ok).toBe(true);
    expect(agent.ok).toBe(true);
    expect(await human.text()).toContain("BidMesh — Human UI Kit");
    expect(await agent.text()).toContain("BidMesh — Agent UI Kit");
  });

  it("creates a deal, replays SSE events, and pauses for approval", async () => {
    const app = await startApp();
    server = app.server;

    const created = await postJson<{
      deal_id: string;
      phase: string;
      events_url: string;
    }>(`${app.url}/api/deals`, {
      seller_id: "seller-usbc-balanced",
      intent: baseIntent()
    });

    expect(created.phase).toBe("open");
    await waitForEvent(app.url, created.deal_id, "human.confirmation_requested");

    const replay = await readSseReplay(app.url, created.events_url);
    expect(replay).toContain("marketplace.selected");
  });

  it("approves a pending deal and emits a mock settlement receipt", async () => {
    const app = await startApp();
    server = app.server;

    const created = await postJson<{ deal_id: string }>(`${app.url}/api/deals`, {
      seller_id: "seller-usbc-balanced",
      intent: baseIntent()
    });
    await waitForEvent(app.url, created.deal_id, "human.confirmation_requested");

    const approved = await postJson<{
      phase: string;
      receipt: { txHash: string; network: string; asset: string };
      events: Array<{ kind: string }>;
    }>(`${app.url}/api/deals/${created.deal_id}/approve`);

    expect(approved.phase).toBe("settled");
    expect(approved.receipt).toMatchObject({
      txHash: "0xDEMO000001",
      network: "base-sepolia",
      asset: "USDC"
    });
    expect(approved.events.some((event) => event.kind === "settlement.mocked")).toBe(true);
    expect(approved.events.some((event) => event.kind === "deal.settled")).toBe(true);
  });

  it("denies a pending deal and walks cleanly", async () => {
    const app = await startApp();
    server = app.server;

    const created = await postJson<{ deal_id: string }>(`${app.url}/api/deals`, {
      seller_id: "seller-usbc-balanced",
      intent: baseIntent()
    });
    await waitForEvent(app.url, created.deal_id, "human.confirmation_requested");

    const denied = await postJson<{
      phase: string;
      events: Array<{ kind: string; reason_code?: string }>;
    }>(`${app.url}/api/deals/${created.deal_id}/deny`);

    expect(denied.phase).toBe("walked");
    expect(denied.events.some((event) => event.kind === "human.denied")).toBe(true);
    expect(denied.events.some((event) => event.reason_code === "human_confirmation_required")).toBe(true);
  });

  it("emits validation.blocked for the forced over-cap safety demo", async () => {
    const app = await startApp();
    server = app.server;

    const created = await postJson<{ deal_id: string }>(`${app.url}/api/deals`, {
      seller_id: "seller-usbc-balanced",
      intent: baseIntent()
    });
    await waitForEvent(app.url, created.deal_id, "human.confirmation_requested");

    const blocked = await postJson<{
      phase: string;
      events: Array<{ kind: string; reason_code?: string; price?: number }>;
    }>(`${app.url}/api/deals/${created.deal_id}/force-over-cap`);

    const blockEvent = blocked.events.find((event) => event.kind === "validation.blocked");
    expect(blocked.phase).toBe("walked");
    expect(blockEvent).toMatchObject({
      reason_code: "accepted_price_exceeds_max_price",
      price: 7
    });
  });
});
