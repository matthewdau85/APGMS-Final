import { describe, expect, it } from "@jest/globals";
import { computeVirtualBalance } from "@apgms/shared/ledger/virtual-balance.js";

jest.mock("../../../shared/src/db.js", () => ({
  prisma: {},
}));

function createPrismaStub(data: {
  accounts?: Array<{ balance?: number; type: string }>;
  gst?: Array<{ netCents: bigint; gstCents: bigint; txDate: Date }>;
  payroll?: Array<{ grossCents: bigint; payPeriodEnd: Date }>;
}) {
  return {
    designatedAccount: {
      findMany: async () => data.accounts ?? [],
    },
    gstTransaction: {
      findMany: async () => data.gst ?? [],
    },
    payrollItem: {
      findMany: async () => data.payroll ?? [],
    },
  } as any;
}

describe("computeVirtualBalance", () => {
  it("summarises balances and liabilities when funds exceed obligations", async () => {
    const prisma = createPrismaStub({
      accounts: [
        { type: "PAYGW_BUFFER", balance: 15_000 },
        { type: "GST_BUFFER", balance: 12_000 },
      ],
      gst: [
        { netCents: 10_000n, gstCents: 1_000n, txDate: new Date("2025-08-01") },
        { netCents: 20_000n, gstCents: 2_000n, txDate: new Date("2025-08-15") },
      ],
      payroll: [
        { grossCents: 5_000_000n, payPeriodEnd: new Date("2025-08-10") },
        { grossCents: 8_000_000n, payPeriodEnd: new Date("2025-08-24") },
      ],
    });

    const result = await computeVirtualBalance("org-1", new Date("2025-08-31"), prisma);
    expect(result.actualBalance).toBeCloseTo(27_000, 2);
    expect(result.taxReserved).toBeCloseTo(19_946, 2);
    expect(result.discretionaryBalance).toBeCloseTo(7_054, 2);
  });

  it("produces a shortfall when liabilities exceed balances", async () => {
    const prisma = createPrismaStub({
      accounts: [
        { type: "PAYGW_BUFFER", balance: 2_000 },
        { type: "GST_BUFFER", balance: 1_000 },
      ],
      gst: [{ netCents: 5_000n, gstCents: 500n, txDate: new Date("2025-08-05") }],
      payroll: [{ grossCents: 6_000_000n, payPeriodEnd: new Date("2025-08-08") }],
    });

    const result = await computeVirtualBalance("org-2", new Date("2025-08-31"), prisma);
    expect(result.actualBalance).toBeCloseTo(3_000, 2);
    expect(result.taxReserved).toBeGreaterThan(result.actualBalance);
    expect(result.discretionaryBalance).toBeLessThan(0);
  });

  it("returns zeros when no data exists", async () => {
    const prisma = createPrismaStub({});
    const result = await computeVirtualBalance("org-3", new Date("2025-08-31"), prisma);
    expect(result).toEqual({ actualBalance: 0, taxReserved: 0, discretionaryBalance: 0 });
  });
});
