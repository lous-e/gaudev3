import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  AcceptRequest,
  CounterRequest,
  OpenRequest,
  StatusRequest,
  WalkRequest
} from "./types";

export type EnvelopeForSigning = {
  protocol: "nuff/v1";
  method:
    | "bidmesh.negotiate.open"
    | "bidmesh.negotiate.counter"
    | "bidmesh.negotiate.accept"
    | "bidmesh.negotiate.walk"
    | "bidmesh.negotiate.status";
  deal_id?: string;
  from_pubkey: string;
  to_pubkey: string;
  round: number;
  timestamp: string;
  expires_at?: string;
  body: OpenRequest | CounterRequest | AcceptRequest | WalkRequest | StatusRequest;
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`)
    .join(",")}}`;
}

export function createRequestFingerprint(envelope: EnvelopeForSigning): string {
  return createHmac("sha256", "bidmesh-fingerprint")
    .update(canonicalize(envelope))
    .digest("hex");
}

export function createMockAuthToken(
  envelope: EnvelopeForSigning,
  sharedSecret: string
): string {
  return createHmac("sha256", sharedSecret).update(canonicalize(envelope)).digest("hex");
}

export function verifyMockAuthToken(
  envelope: EnvelopeForSigning,
  providedToken: string,
  sharedSecret: string
): boolean {
  const expected = createMockAuthToken(envelope, sharedSecret);
  const provided = Buffer.from(providedToken, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (provided.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(provided, expectedBuffer);
}
