// packages/domain-policy/src/ledger/tax-ledger.ts

import crypto from "node:crypto";
import { prisma } from "@apgms/shared/db.js";

// --- Types -------------------------------------------------------------------

export type LedgerCategory = "PAYGW" | "GST" | "PENALTY" | "ADJUSTMENT";
export type LedgerDirection = "DEBIT" | "CREDIT";

export interface LedgerPostArgs {
  orgId: string;
  period: string;
  category: LedgerCategory;
  direction: LedgerDirection;
  amountCents: number;
  description?: string;
  effectiveAt?: Date;
}

// --- Hash helper -------------------------------------------------------------

function computeLedgerHashSelf(input: {
  orgId: string;
  period: string;
  category: string;
  direction: string;
  amountCents: number;
  effectiveAt: Date;
  hashPrev: string | null;
}): string {
  const payload = JSON.stringify({
    orgId: input.orgId,
    period: input.period,
    category: input.category,
    direction: input.direction,
    amountCents: input.amountCents,
    effectiveAt: input.effectiveAt.toISOString(),
    hashPrev: input.hashPrev,
  });

  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function toNumberCents(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
}

// --- Append entry (with hash chain) -----------------------------------------

export async function appendLedgerEntry(args: LedgerPostArgs) {
  const effectiveAt = args.effectiveAt ?? new Date();

  return prisma.$transaction(async (tx: any) => {
    const last = await tx.taxLedgerEntry.findFirst({
      where: {
        orgId: args.orgId,
        period: args.period,
        category: args.category,
      },
      orderBy: { createdAt: "desc" },
    });

    const hashPrev = last?.hashSelf ?? null;

    const hashSelf = computeLedgerHashSelf({
      orgId: args.orgId,
      period: args.period,
      category: args.category,
      direction: args.direction,
      amountCents: args.amountCents,
      effectiveAt,
      hashPrev,
    });

    const created = await tx.taxLedgerEntry.create({
      data: {
        orgId: args.orgId,
        period: args.period,
        category: args.category,
        direction: args.direction,
        amountCents: args.amountCents,
        description: args.description ?? null,
        effectiveAt,
        hashPrev,
        hashSelf,
      },
    });

    return created;
  });
}

// --- Balance computation -----------------------------------------------------

export interface LedgerTotals {
  PAYGW?: number;
  GST?: number;
  PENALTY?: number;
  ADJUSTMENT?: number;
}

export async function getLedgerBalanceForPeriod(orgId: string, period: string): Promise<LedgerTotals> {
  const entries = await prisma.taxLedgerEntry.findMany({
    where: { orgId, period },
    orderBy: { createdAt: "asc" },
  });

  const totals: LedgerTotals = { PAYGW: 0, GST: 0, PENALTY: 0, ADJUSTMENT: 0 };

  for (const e of entries) {
    const cat = e.category as LedgerCategory;
    const direction = e.direction as LedgerDirection;

    const amount = toNumberCents(e.amountCents);
    const sign = direction === "DEBIT" ? -1 : 1;

    totals[cat] = (totals[cat] ?? 0) + sign * amount;
  }

  return totals;
}

// --- Period hash (for evidence packs) ----------------------------------------

export async function getLedgerHashForPeriod(orgId: string, period: string): Promise<string> {
  const entries = await prisma.taxLedgerEntry.findMany({
    where: { orgId, period },
    select: { hashSelf: true },
    orderBy: { createdAt: "asc" },
  });

  const joined = (entries as Array<{ hashSelf: string }>).map((e) => e.hashSelf).join("|");
  return crypto.createHash("sha256").update(joined, "utf8").digest("hex");
}

// --- Chain verification ------------------------------------------------------

export interface LedgerVerificationResult {
  ok: boolean;
  firstInvalidIndex?: number;
  reason?: string;
}

/**
 * Verifies integrity of the hash chain for org + period.
 * Chains are maintained per category.
 */
export async function verifyLedgerChain(
  orgId: string,
  period: string
): Promise<LedgerVerificationResult> {
  const entries = await prisma.taxLedgerEntry.findMany({
    where: { orgId, period },
    orderBy: { createdAt: "asc" },
  });

  if (entries.length === 0) return { ok: true };

  const expectedPrevByCategory: Record<string, string | null> = {};

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const categoryKey = e.category;

    const expectedPrev = Object.prototype.hasOwnProperty.call(expectedPrevByCategory, categoryKey)
      ? expectedPrevByCategory[categoryKey]
      : null;

    if (e.hashPrev !== expectedPrev) {
      return { ok: false, firstInvalidIndex: i, reason: `hashPrev mismatch at index ${i}` };
    }

    const recomputed = computeLedgerHashSelf({
      orgId: e.orgId,
      period: e.period,
      category: e.category,
      direction: e.direction,
      amountCents: toNumberCents(e.amountCents),
      effectiveAt: e.effectiveAt,
      hashPrev: e.hashPrev,
    });

    if (recomputed !== e.hashSelf) {
      return { ok: false, firstInvalidIndex: i, reason: `hashSelf mismatch at index ${i}` };
    }

    expectedPrevByCategory[categoryKey] = e.hashSelf;
  }

  return { ok: true };
}
