import { describe, expect, it } from "@jest/globals";
import { predictTaxObligations } from "@apgms/shared/predict.js";

jest.mock("../../../shared/src/db.js", () => ({
  prisma: {},
}));

function createPredictPrisma(data: {
  gst?: Array<{ gstCents: bigint; txDate: Date }>;
  payroll?: Array<{ paygwCents: bigint; payPeriodEnd: Date }>;
}) {
  return {
    gstTransaction: {
      findMany: async () => data.gst ?? [],
    },
    payrollItem: {
      findMany: async () => data.payroll ?? [],
    },
  } as any;
}

describe("predictTaxObligations", () => {
  it("projects estimates based on a rolling three-month window", async () => {
    const prisma = createPredictPrisma({
      gst: [
        { gstCents: 10_000n, txDate: new Date("2025-06-15") },
        { gstCents: 20_000n, txDate: new Date("2025-07-10") },
        { gstCents: 30_000n, txDate: new Date("2025-08-05") },
      ],
      payroll: [
        { paygwCents: 40_000n, payPeriodEnd: new Date("2025-06-01") },
        { paygwCents: 50_000n, payPeriodEnd: new Date("2025-07-01") },
        { paygwCents: 60_000n, payPeriodEnd: new Date("2025-08-01") },
      ],
    });

    const result = await predictTaxObligations("org-1", 30, prisma);
    expect(result.gstEstimate).toBeCloseTo(200, 2);
    expect(result.paygwEstimate).toBeCloseTo(500, 2);
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("defaults to low confidence when no history exists", async () => {
    const prisma = createPredictPrisma({});
    const result = await predictTaxObligations("org-1", 45, prisma);
    expect(result.gstEstimate).toBe(0);
    expect(result.paygwEstimate).toBe(0);
    expect(result.confidence).toBeCloseTo(0.3, 2);
  });
});
