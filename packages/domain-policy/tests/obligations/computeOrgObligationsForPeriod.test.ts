// packages/domain-policy/tests/obligations/computeOrgObligationsForPeriod.test.ts

import { computeOrgObligationsForPeriod } from "../../src/obligations/computeOrgObligationsForPeriod";

// Jest hoists this mock – keep it above imports that use prisma.
const mockPayrollFindMany = jest.fn();
const mockGstFindMany = jest.fn();

jest.mock("@apgms/shared/db.js", () => {
  return {
    prisma: {
      payrollItem: {
        findMany: mockPayrollFindMany,
      },
      gstTransaction: {
        findMany: mockGstFindMany,
      },
    },
  };
});

describe("computeOrgObligationsForPeriod (DB adapter)", () => {
  const orgId = "org-oblig-test";
  const period = "2025-Q1";

  beforeEach(() => {
    mockPayrollFindMany.mockReset();
    mockGstFindMany.mockReset();
  });

  it("fetches payroll + GST by orgId and period and aggregates correctly", async () => {
    // 🔹 THIS IS WHERE THOSE LINES GO
    mockPayrollFindMany.mockResolvedValue([
      { orgId, period, paygwCents: 1_000 },
      { orgId, period, paygwCents: 2_000 },
    ]);

    mockGstFindMany.mockResolvedValue([
      { orgId, period, gstCents: 500 },
      { orgId, period, gstCents: -200 },
    ]);

    const result = await computeOrgObligationsForPeriod(orgId, period);

    expect(mockPayrollFindMany).toHaveBeenCalledWith({
      where: { orgId, period },
      select: { orgId: true, period: true, paygwCents: true },
    });

    expect(mockGstFindMany).toHaveBeenCalledWith({
      where: { orgId, period },
      select: { orgId: true, period: true, gstCents: true },
    });

    expect(result.paygwCents).toBe(3_000);
    expect(result.gstCents).toBe(300);
  });

  it("treats empty result sets as zero obligations", async () => {
    mockPayrollFindMany.mockResolvedValue([]);
    mockGstFindMany.mockResolvedValue([]);

    const result = await computeOrgObligationsForPeriod(orgId, period);

    expect(result.paygwCents).toBe(0);
    expect(result.gstCents).toBe(0);
  });
});
