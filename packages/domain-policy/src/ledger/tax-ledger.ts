import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

export type LedgerCategory = 'PAYGW' | 'GST' | 'PENALTY' | 'ADJUSTMENT';
export type LedgerDirection = 'DEBIT' | 'CREDIT';

export interface LedgerPostArgs {
  orgId: string;
  period: string;
  category: LedgerCategory;
  direction: LedgerDirection;
  amountCents: number;
  description?: string;
}

function computeHashSelf(input: {
  orgId: string;
  period: string;
  category: string;
  direction: string;
  amountCents: number;
  effectiveAt: Date;
  hashPrev?: string | null;
}) {
  const payload = JSON.stringify({
    orgId: input.orgId,
    period: input.period,
    category: input.category,
    direction: input.direction,
    amountCents: input.amountCents,
    effectiveAt: input.effectiveAt.toISOString(),
    hashPrev: input.hashPrev ?? null,
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function postLedgerEntry(args: LedgerPostArgs) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.taxLedgerEntry.findFirst({
      where: { orgId: args.orgId },
      orderBy: { createdAt: 'desc' },
    });

    const effectiveAt = new Date();
    const hashSelf = computeHashSelf({
      orgId: args.orgId,
      period: args.period,
      category: args.category,
      direction: args.direction,
      amountCents: args.amountCents,
      effectiveAt,
      hashPrev: last?.hashSelf ?? null,
    });

    const created = await tx.taxLedgerEntry.create({
      data: {
        orgId: args.orgId,
        period: args.period,
        category: args.category,
        direction: args.direction,
        amountCents: args.amountCents,
        description: args.description,
        effectiveAt,
        hashPrev: last?.hashSelf ?? null,
        hashSelf,
      },
    });

    return created;
  });
}

export async function getLedgerBalanceForPeriod(orgId: string, period: string) {
  const entries = await prisma.taxLedgerEntry.findMany({
    where: { orgId, period },
  });

  const totals = {
    PAYGW: 0,
    GST: 0,
    PENALTY: 0,
    ADJUSTMENT: 0,
  } as Record<LedgerCategory, number>;

  for (const e of entries) {
    const cat = e.category as LedgerCategory;
    const sign = e.direction === 'DEBIT' ? -1 : 1;
    totals[cat] += sign * e.amountCents;
  }

  return totals;
}
