import type { PrismaClient } from "@prisma/client";

import { prisma } from "../db.js";
import { calculateGst, calculatePaygw, type PaygwBracketSet } from "../tax/index.js";
import { GST_RATE } from "../tax/tables.js";

export type VirtualBalance = {
  actualBalance: number;
  taxReserved: number;
  discretionaryBalance: number;
};

const DEFAULT_LOOKBACK_MONTHS = 12;

const DEFAULT_PAYGW_BRACKETS: PaygwBracketSet = [
  { threshold: 18_200, rate: 0, base: 0 },
  { threshold: 45_000, rate: 0.19, base: -3_458 },
  { threshold: 120_000, rate: 0.325, base: -11_167 },
  { threshold: 180_000, rate: 0.37, base: -29_147 },
  { threshold: Number.MAX_SAFE_INTEGER, rate: 0.45, base: -51_667 },
];

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumberCents(value: bigint | number | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return 0;
}

function normalizeAsOf(asOf?: Date): Date {
  const date = asOf ? new Date(asOf) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

export async function computeVirtualBalance(
  orgId: string,
  asOf: Date = new Date(),
  prismaClient: PrismaClient = prisma,
): Promise<VirtualBalance> {
  const effectiveAsOf = normalizeAsOf(asOf);
  const lookbackStart = new Date(effectiveAsOf.getTime());
  lookbackStart.setMonth(lookbackStart.getMonth() - DEFAULT_LOOKBACK_MONTHS);

  const [accounts, gstTransactions, payrollItems] = await Promise.all([
    prismaClient.designatedAccount.findMany({
      where: { orgId, type: { in: ["PAYGW_BUFFER", "GST_BUFFER"] } },
    }),
    prismaClient.gstTransaction.findMany({
      where: {
        orgId,
        basPeriodId: null,
        txDate: { gte: lookbackStart, lte: effectiveAsOf },
      },
    }),
    prismaClient.payrollItem.findMany({
      where: {
        orgId,
        payPeriodEnd: { gte: lookbackStart, lte: effectiveAsOf },
      },
    }),
  ]);

  const actualBalance = roundCurrency(
    accounts.reduce(
      (sum: number, account: (typeof accounts)[number]) => sum + Number(account.balance ?? 0),
      0,
    ),
  );

  const gstReserved = gstTransactions.reduce((
    sum: number,
    tx: (typeof gstTransactions)[number],
  ) => {
    const netCents = toNumberCents(tx.netCents as bigint | number | null);
    const gstCents = toNumberCents(tx.gstCents as bigint | number | null);
    const grossAmount = (netCents + gstCents) / 100;
    if (grossAmount <= 0) {
      return sum;
    }
    const { gstPortion } = calculateGst({ amount: grossAmount, rate: GST_RATE });
    return sum + gstPortion;
  }, 0);

  const paygwReserved = payrollItems.reduce((
    sum: number,
    item: (typeof payrollItems)[number],
  ) => {
    const taxableIncome = toNumberCents(item.grossCents as bigint | number | null) / 100;
    if (taxableIncome <= 0) {
      return sum;
    }
    const result = calculatePaygw({
      taxableIncome,
      brackets: DEFAULT_PAYGW_BRACKETS,
    });
    return sum + result.withheld;
  }, 0);

  const taxReserved = roundCurrency(gstReserved + paygwReserved);
  const discretionaryBalance = roundCurrency(actualBalance - taxReserved);

  return {
    actualBalance,
    taxReserved,
    discretionaryBalance,
  };
}
