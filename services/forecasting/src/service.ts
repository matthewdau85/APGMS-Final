export type ForecastingOptions = {
  lookback?: number;
  alpha?: number;
  method?: string;
};

export type ForecastSnapshot = {
  id: string;
  orgId: string;
  snapshotDate: string;
  paygwForecast: number;
  gstForecast: number;
  method: string;
  metadata: Record<string, unknown> | null;
};

type PrismaClient = {
  basCycle: {
    findMany(args: any): Promise<Array<{ paygwRequired: unknown; gstRequired: unknown }>>;
  };
  forecastSnapshot: {
    create(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    findFirst(args: any): Promise<any | null>;
  };
};

async function computeForecast(
  prisma: PrismaClient,
  orgId: string,
  lookback = 6,
  alpha = 0.6,
): Promise<{
  paygwForecast: number;
  gstForecast: number;
  baselineCycles: number;
  trend: { paygwDelta: number; gstDelta: number };
}> {
  const cycles = await prisma.basCycle.findMany({
    where: { orgId },
    orderBy: { periodEnd: "desc" },
    take: lookback,
  });
  const count = cycles.length;
  if (count === 0) {
    return { paygwForecast: 0, gstForecast: 0, baselineCycles: 0, trend: { paygwDelta: 0, gstDelta: 0 } };
  }
  let weightedPaygw = 0;
  let weightedGst = 0;
  let weightSum = 0;
  for (let i = 0; i < count; i += 1) {
    const weight = Math.pow(alpha, count - i - 1);
    weightedPaygw += Number(cycles[i].paygwRequired ?? 0) * weight;
    weightedGst += Number(cycles[i].gstRequired ?? 0) * weight;
    weightSum += weight;
  }
  const paygwForecast = weightSum ? weightedPaygw / weightSum : 0;
  const gstForecast = weightSum ? weightedGst / weightSum : 0;

  const xMean = (1 + count) / 2;
  const yPaygwMean = cycles.reduce((sum, cycle) => sum + Number(cycle.paygwRequired ?? 0), 0) / count;
  const yGstMean = cycles.reduce((sum, cycle) => sum + Number(cycle.gstRequired ?? 0), 0) / count;

  let numeratorPaygw = 0;
  let numeratorGst = 0;
  let denominator = 0;
  for (let i = 0; i < count; i += 1) {
    const x = i + 1;
    denominator += (x - xMean) ** 2;
    numeratorPaygw += (x - xMean) * (Number(cycles[i].paygwRequired ?? 0) - yPaygwMean);
    numeratorGst += (x - xMean) * (Number(cycles[i].gstRequired ?? 0) - yGstMean);
  }

  const deltaPaygw = denominator > 0 ? numeratorPaygw / denominator : 0;
  const deltaGst = denominator > 0 ? numeratorGst / denominator : 0;

  return { paygwForecast, gstForecast, baselineCycles: count, trend: { paygwDelta: deltaPaygw, gstDelta: deltaGst } };
}

function mapSnapshot(model: any): ForecastSnapshot {
  return {
    id: model.id,
    orgId: model.orgId,
    snapshotDate: new Date(model.snapshotDate).toISOString(),
    paygwForecast: Number(model.paygwForecast),
    gstForecast: Number(model.gstForecast),
    method: model.method,
    metadata: (model.metadataJson as Record<string, unknown> | null) ?? null,
  };
}

export async function captureForecastSnapshot(
  prisma: PrismaClient,
  orgId: string,
  options: ForecastingOptions = {},
) {
  const forecast = await computeForecast(prisma, orgId, options.lookback, options.alpha);
  const snapshot = await prisma.forecastSnapshot.create({
    data: {
      orgId,
      paygwForecast: forecast.paygwForecast,
      gstForecast: forecast.gstForecast,
      method: options.method ?? "exp_smoothing",
      metadataJson: {
        baselineCycles: forecast.baselineCycles,
        trend: forecast.trend,
        lookback: options.lookback ?? 6,
        alpha: options.alpha ?? 0.6,
      },
    },
  });
  return { snapshot: mapSnapshot(snapshot), forecast };
}

export async function listForecastSnapshots(prisma: PrismaClient, orgId: string, limit = 20) {
  const rows = await prisma.forecastSnapshot.findMany({
    where: { orgId },
    orderBy: { snapshotDate: "desc" },
    take: limit,
  });
  return rows.map(mapSnapshot);
}

export async function latestForecastSnapshot(prisma: PrismaClient, orgId: string) {
  const row = await prisma.forecastSnapshot.findFirst({
    where: { orgId },
    orderBy: { snapshotDate: "desc" },
  });
  return row ? mapSnapshot(row) : null;
}
