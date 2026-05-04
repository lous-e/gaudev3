// Developer 1 owns this file. Stub only — do not implement.
import type { BuyerIntent, SellerPolicy, ValidationResult } from "./types";

export function validateBuyerAction(
  _action: "open" | "counter" | "accept" | "settle",
  _price: number,
  _intent: BuyerIntent,
  _humanConfirmed: boolean
): ValidationResult {
  throw new Error("validation.ts: not implemented by Developer 1 yet");
}

export function validateSellerAction(
  _action: "accept" | "counter",
  _price: number,
  _quantity: number,
  _policy: SellerPolicy
): ValidationResult {
  throw new Error("validation.ts: not implemented by Developer 1 yet");
}
