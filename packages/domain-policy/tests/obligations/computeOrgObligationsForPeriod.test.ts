// packages/domain-policy/tests/obligations/computeOrgObligationsForPeriod.test.ts

import { computeOrgObligationsForPeriod } from "../../src/obligations/computeOrgObligationsForPeriod";

// IMPORTANT: jest.mock is hoisted. If you reference const/let here, you can hit TDZ.
// Use `var` and assign inside the factory.
// eslint-disable-next-line no-var
var mockPayrollFindMany: jest.Mock;
// eslint-disable-next-line no-var
var mockGstFindMany: jest.Mock;

jest.mock("@apgms/shared/db.js", () => {
  mockPayrollFindMany = jest.fn();
  mockGstFindMany = jest.fn();

  return {
    prisma: {
      payrollItem: {
        findMany: (...args: any[]) => mockPayrollFindMany(...args),
      },
      gstTransaction: {
        findMany: (...args: any[]) => mockGstFindMany(...args),
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
