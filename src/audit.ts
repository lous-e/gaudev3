import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  buyerAuditEntrySchema,
  sellerAuditEntrySchema
} from "./schemas";
import type { BuyerAuditEntry, SellerAuditEntry } from "./types";

const DEFAULT_BUYER_AUDIT_LOG_PATH = "buyer/workspace/memory/audit.log";

async function appendJsonLine(path: string, payload: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(payload)}\n`, "utf8");
}

export async function appendBuyerAuditEntry(
  path: string,
  entry: BuyerAuditEntry
): Promise<void> {
  appendBuyerAuditEntrySyncValidation(entry);
  await appendJsonLine(path, entry);
}

export function writeBuyerAudit(entry: BuyerAuditEntry): Promise<void> {
  return appendBuyerAuditEntry(DEFAULT_BUYER_AUDIT_LOG_PATH, entry);
}

export async function appendSellerAuditEntry(
  path: string,
  entry: SellerAuditEntry
): Promise<void> {
  appendSellerAuditEntrySyncValidation(entry);
  await appendJsonLine(path, entry);
}

function appendBuyerAuditEntrySyncValidation(entry: BuyerAuditEntry): void {
  buyerAuditEntrySchema.parse(entry);
}

function appendSellerAuditEntrySyncValidation(entry: SellerAuditEntry): void {
  sellerAuditEntrySchema.parse(entry);
}
