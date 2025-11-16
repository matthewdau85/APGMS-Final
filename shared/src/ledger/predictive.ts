import type { PrismaClient } from "@prisma/client";

export type ForecastResult = {
  paygwForecast: number;
  gstForecast: number;
  baselineCycles: number;
};

export async function forecastObligations(
  prisma: PrismaClient,
  orgId: string,
  lookback = 4,
): Promise<ForecastResult> {
  const cycles = await prisma.basCycle.findMany({
    where: { orgId },
    orderBy: { periodEnd: "desc" },
    take: lookback,
  });
  const count = cycles.length;
  if (count === 0) {
    return { paygwForecast: 0, gstForecast: 0, baselineCycles: 0 };
  }

  const totals = cycles.reduce(
    (acc, cycle) => {
      acc.paygw += Number(cycle.paygwRequired);
      acc.gst += Number(cycle.gstRequired);
      return acc;
    },
    { paygw: 0, gst: 0 },
  );

  return {
    paygwForecast: totals.paygw / count,
    gstForecast: totals.gst / count,
    baselineCycles: count,
  };
}

export type TierStatus = "reserve" | "automate" | "escalate";

export function computeTierStatus(balance: number, forecast: number, margin = 0): TierStatus {
  if (balance >= forecast + margin) {
    return "reserve";
  }
  if (balance >= forecast) {
    return "automate";
  }
  return "escalate";
}
