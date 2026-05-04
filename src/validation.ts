import type {
  BuyerAction,
  BuyerIntent,
  SellerPolicy,
  SellerValidationAction,
  ValidationResult
} from "./types";

export function validateBuyerAction(
  action: BuyerAction,
  sessionPolicy: BuyerIntent
): ValidationResult {
  switch (action.type) {
    case "open":
      if (action.price > sessionPolicy.max_price) {
        return { allow: false, reason: "opening_offer_exceeds_max_price" };
      }
      return { allow: true };
    case "counter":
      if (action.price > sessionPolicy.max_price) {
        return { allow: false, reason: "counter_offer_exceeds_max_price" };
      }
      return { allow: true };
    case "accept":
      if (action.price > sessionPolicy.max_price) {
        return { allow: false, reason: "accepted_price_exceeds_max_price" };
      }
      return { allow: true };
    case "settle":
      if (action.accepted_price > sessionPolicy.max_price) {
        return { allow: false, reason: "accepted_price_exceeds_max_price" };
      }
      if (action.amount !== action.accepted_price) {
        return { allow: false, reason: "settlement_amount_mismatch" };
      }
      if (
        sessionPolicy.require_human_confirmation_before_payment &&
        !action.human_confirmation
      ) {
        return { allow: false, reason: "human_confirmation_missing" };
      }
      return { allow: true };
  }
}

export function validateSellerAction(
  action: SellerValidationAction,
  policy: SellerPolicy
): ValidationResult {
  if (action.quantity <= 0) {
    return { allow: false, reason: "invalid_quantity" };
  }
  if (action.currency !== policy.currency) {
    return { allow: false, reason: "currency_unsupported" };
  }
  if (action.quantity > policy.inventory_available) {
    return { allow: false, reason: "inventory_unavailable" };
  }

  if (action.type === "accept" || action.type === "settle") {
    const acceptedPrice = action.accepted_price;
    if (acceptedPrice < policy.min_price) {
      return { allow: false, reason: "below_min_price" };
    }
  }

  if (action.type === "settle" && policy.reservation_deadline) {
    const now = action.now ?? new Date().toISOString();
    const nowTime = new Date(now).getTime();
    const deadlineTime = new Date(policy.reservation_deadline).getTime();
    if (Number.isNaN(nowTime) || Number.isNaN(deadlineTime)) {
      return { allow: false, reason: "reservation_expired" };
    }
    if (nowTime > deadlineTime) {
      return { allow: false, reason: "reservation_expired" };
    }
  }

  return { allow: true };
}
