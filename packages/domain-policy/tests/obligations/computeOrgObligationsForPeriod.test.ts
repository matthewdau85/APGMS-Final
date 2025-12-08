// packages/domain-policy/tests/obligations/computeOrgObligationsForPeriod.test.ts

import { computeOrgObligationsForPeriod } from "../../src/obligations/computeOrgObligationsForPeriod";

// Jest hoists this mock – must be above any imports that use prisma in this file.
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

describe("computeOrgObligationsForPeriod (adapter)", () => {
  const orgId = "org-oblig-test";
  const period = "2025-Q1";

  beforeEach(() => {
    mockPayrollFindMany.mockReset();
    mockGstFindMany.mockReset();
  });

  it("fetches payroll + GST and feeds into the calculator", async () => {
    mockPayrollFindMany.mockResolvedValue([
      { orgId, paygwCents: 1_000 },
      { orgId, paygwCents: 2_000 },
    ]);

    mockGstFindMany.mockResolvedValue([
      { orgId, gstCents: 500 },
      { orgId, gstCents: -200 },
    ]);

    const result = await computeOrgObligationsForPeriod(orgId, period);

    // Adapter should have hit Prisma with orgId filter
    expect(mockPayrollFindMany).toHaveBeenCalledWith({
      where: { orgId },
      select: { orgId: true, paygwCents: true },
    });
    expect(mockGstFindMany).toHaveBeenCalledWith({
      where: { orgId },
      select: { orgId: true, gstCents: true },
    });

    // And the computed obligations should reflect the mocked data
    expect(result.paygwCents).toBe(3_000);
    expect(result.gstCents).toBe(300);
  });

  it("handles empty arrays from Prisma as zero obligations", async () => {
    mockPayrollFindMany.mockResolvedValue([]);
    mockGstFindMany.mockResolvedValue([]);

    const result = await computeOrgObligationsForPeriod(orgId, period);

    expect(result.paygwCents).toBe(0);
    expect(result.gstCents).toBe(0);
  });
});
