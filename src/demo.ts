import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runBuyerNegotiation } from "./buyer-agent";
import { createSellerServer } from "./seller-server";
import type { BuyerIntent, BuyerStrategy, SellerPolicy } from "./types";

const SELLER_PORT = Number(process.env.PORT ?? 3001);
const SELLER_PUBKEY = "mock-seller-pubkey";

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

  const app = createSellerServer(sellerPolicy);
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
      askForHumanConfirmation
    );

    if (result.transcript) {
      console.log("");
      console.log(result.transcript.join("\n"));
      console.log("");
    }

    if (result.settled) {
      console.log(`[Settled] txHash: ${result.txHash ?? "missing"}`);
      console.log(`[Artifact] ${result.artifact ?? "missing"}`);
      console.log(`[Deal] ${JSON.stringify(result.deal, null, 2)}`);
    } else {
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
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
