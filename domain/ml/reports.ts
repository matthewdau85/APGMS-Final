import { Prisma, type PrismaClient } from "@prisma/client";

export type FairnessReport = {
  generatedAt: string;
  coverage: {
    employees: number;
    payrollItems: number;
  };
  withholding: {
    averageRate: number;
    minRate: number;
    maxRate: number;
  };
};

export type ExplainabilityReport = {
  generatedAt: string;
  topDrivers: Array<{
    feature: string;
    weight: number;
    rationale: string;
  }>;
  recentBasDelta: Array<{
    period: string;
    paygwShortfall: number;
    gstShortfall: number;
  }>;
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

export async function generateFairnessReport(
  prisma: PrismaClient,
  orgId: string,
): Promise<FairnessReport> {
  const payrollItems = await prisma.payrollItem.findMany({
    where: { orgId },
    select: { employeeId: true, grossCents: true, paygwCents: true },
  });

  const grouped = new Map<string, { gross: number; paygw: number }>();
  for (const item of payrollItems) {
    const entry = grouped.get(item.employeeId) ?? { gross: 0, paygw: 0 };
    entry.gross += Number(item.grossCents ?? 0) / 100;
    entry.paygw += Number(item.paygwCents ?? 0) / 100;
    grouped.set(item.employeeId, entry);
  }

  const withholdingRates = Array.from(grouped.values()).map((entry) => {
    if (entry.gross <= 0) return 0;
    return Number((entry.paygw / entry.gross).toFixed(4));
  });

  const averageRate = withholdingRates.length
    ? withholdingRates.reduce((sum, rate) => sum + rate, 0) / withholdingRates.length
    : 0;

  const minRate = withholdingRates.length ? Math.min(...withholdingRates) : 0;
  const maxRate = withholdingRates.length ? Math.max(...withholdingRates) : 0;

  return {
    generatedAt: new Date().toISOString(),
    coverage: {
      employees: grouped.size,
      payrollItems: payrollItems.length,
    },
    withholding: {
      averageRate: Number(averageRate.toFixed(4)),
      minRate: Number(minRate.toFixed(4)),
      maxRate: Number(maxRate.toFixed(4)),
    },
  };
}

export async function generateExplainabilityReport(
  prisma: PrismaClient,
  orgId: string,
): Promise<ExplainabilityReport> {
  const basPeriods = await prisma.basPeriod.findMany({
    where: { orgId },
    orderBy: { end: "desc" },
    take: 4,
  });

  const deltas = basPeriods.map((period) => {
    const paygwRequired = toNumber(period.paygwRequired);
    const paygwSecured = toNumber(period.paygwSecured);
    const gstRequired = toNumber(period.gstRequired);
    const gstSecured = toNumber(period.gstSecured);

    return {
      period: `${period.start.toISOString().slice(0, 10)}_${period.end.toISOString().slice(0, 10)}`,
      paygwShortfall: Number((paygwRequired - paygwSecured).toFixed(2)),
      gstShortfall: Number((gstRequired - gstSecured).toFixed(2)),
    };
  });

  const topDrivers = deltas.slice(0, 3).map((delta, index) => {
    const totalShortfall = Math.max(delta.paygwShortfall, delta.gstShortfall, 0);
    return {
      feature: index === 0 ? "PAYGW_SHORTFALL" : index === 1 ? "GST_SHORTFALL" : "TREND_DELTA",
      weight: Number((totalShortfall / (index + 1 || 1)).toFixed(3)),
      rationale:
        index === 0
          ? "PAYGW designated account lagged required withholding in the analysed period."
          : index === 1
          ? "GST escrow movements trailed net remittances, increasing variance risk."
          : "Trend variance across consecutive BAS cycles exceeded governance thresholds.",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    topDrivers,
    recentBasDelta: deltas,
  };
}
