import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  buyerAuditEntrySchema,
  sellerAuditEntrySchema
} from "./schemas";
import type { BuyerAuditEntry, SellerAuditEntry } from "./types";

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
