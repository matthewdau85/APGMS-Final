import { PrismaClient } from '@prisma/client';
import { getLedgerBalanceForPeriod } from '../ledger/tax-ledger';

const prisma = new PrismaClient();

export interface BasEvidencePack {
  orgId: string;
  period: string;
  ledgerTotals: Record<string, number>;
  createdAt: string;
  ledgerEntryCount: number;
}

export async function buildBasEvidencePack(orgId: string, period: string): Promise<BasEvidencePack> {
  const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);
  const count = await prisma.taxLedgerEntry.count({ where: { orgId, period } });

  return {
    orgId,
    period,
    ledgerTotals,
    ledgerEntryCount: count,
    createdAt: new Date().toISOString(),
  };
}
