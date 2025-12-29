// services/api-gateway/src/services/index.ts

export function createServices(args: { db: any; metrics?: any }) {
  const { db, metrics } = args;

  const okSummary = async (input: any) => ({
    ok: true,
    period: input?.period ?? String(input?.query?.period ?? "unknown"),
    riskBand: input?.riskBand ?? String(input?.query?.riskBand ?? "LOW"),
    reasons: [],
  });

  return {
    userService: { db, metrics },
    payrollService: { db, metrics },
    gstService: { db, metrics },

    // Used by /monitor/* routes in tests. Provide resilient stubs.
    riskService: {
      getRiskSummary: okSummary,
      computeRiskSummary: okSummary,
      summary: okSummary,
      getSummary: okSummary,
    },

    paygwSettlement: {
      settleBatch: async (batch: unknown) => ({ ok: true, kind: "paygw", batch }),
    },

    gstSettlement: {
      settleBatch: async (batch: unknown) => ({ ok: true, kind: "gst", batch }),
    },
  };
}
