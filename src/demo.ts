import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runBuyerNegotiation } from "./buyer-agent";
import { createSellerServer } from "./seller-server";
import type { BuyerIntent, BuyerSession, BuyerStrategy, SellerPolicy } from "./types";

const SELLER_PORT = Number(process.env.PORT ?? 3001);
const SELLER_PUBKEY = "mock-seller-pubkey";
const BUYER_PUBKEY = "mock-buyer-pubkey";
const BUYER_SHARED_SECRET = "demo-buyer-secret";

function askForHumanConfirmation(summary: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });

  return rl
    .question(`${summary}\n\n> `)
    .then((answer) => answer.trim().toLowerCase() === "y")
    .finally(() => rl.close());
}

async function main(): Promise<void> {
  const maxPrice = Number(process.env.BUYER_MAX_PRICE ?? 5);

  if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
    throw new Error("BUYER_MAX_PRICE must be a positive number when provided.");
  }

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

  const intent: BuyerIntent = {
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

  const strategy: BuyerStrategy = {
    opening_offer: 4,
    preferred_price: 4,
    concession_schedule: "linear",
    walkaway_after_rounds: 3
  };
  const buyerSession: BuyerSession = {
    buyer_pubkey: BUYER_PUBKEY,
    shared_secret: BUYER_SHARED_SECRET
  };

  const app = createSellerServer(sellerPolicy, {
    sellerPubkey: SELLER_PUBKEY,
    buyerSecrets: {
      [BUYER_PUBKEY]: BUYER_SHARED_SECRET
    }
  });
  const server = app.listen(SELLER_PORT);
  const sellerUrl = process.env.SELLER_URL ?? `http://localhost:${SELLER_PORT}`;

  console.log("[Demo] BidMesh Negotiate");
  console.log(`[Seller] ${sellerPolicy.item_name} list ${sellerPolicy.list_price.toFixed(2)} ${sellerPolicy.currency}, floor ${sellerPolicy.min_price.toFixed(2)} ${sellerPolicy.currency}`);

  try {
    const result = await runBuyerNegotiation(
      intent,
      strategy,
      sellerUrl,
      SELLER_PUBKEY,
      askForHumanConfirmation,
      buyerSession
    );

    if (result.settled) {
      if (result.transcript?.length) {
        console.log(result.transcript.join("\n"));
      }
      console.log(`[Settled] txHash: ${result.txHash ?? "missing"}`);
      console.log(`[Artifact] ${result.artifact ?? "missing"}`);
      console.log(`[Deal] ${JSON.stringify(result.deal, null, 2)}`);
    } else {
      if (result.transcript?.length) {
        console.log(result.transcript.join("\n"));
      }
      console.log("[Walked] No settlement initiated.");
      if (result.deal) {
        console.log(`[Deal] ${JSON.stringify(result.deal, null, 2)}`);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("not implemented by Developer 1 yet")) {
    console.error("[Blocked] Demo runtime is waiting on Developer 1 core/server implementations.");
    console.error(message);
  } else {
    console.error(message);
  }

  process.exitCode = 1;
});
