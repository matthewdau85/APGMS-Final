// packages/domain-policy/tests/obligations/computeOrgObligationsForPeriod.test.ts

import { computeOrgObligationsForPeriod } from "../../src/obligations/computeOrgObligationsForPeriod";

// Mock the shared Prisma client by path that matches moduleNameMapper
jest.mock("@apgms/shared/db.js", () => ({
  prisma: {
    payrollItem: {
      findMany: jest.fn().mockResolvedValue([
        { orgId: "org-1", paygwCents: 100 },
        { orgId: "org-1", paygwCents: 200 },
      ]),
    },
    gstTransaction: {
      findMany: jest.fn().mockResolvedValue([
        { orgId: "org-1", gstCents: 50 },
        { orgId: "org-1", gstCents: 50 },
      ]),
    },
  },
}));

describe("computeOrgObligationsForPeriod (DB adapter)", () => {
  it("aggregates PAYGW and GST from Prisma", async () => {
    const result = await computeOrgObligationsForPeriod("org-1", "2025-Q3");

    expect(result.paygwCents).toBe(300);
    expect(result.gstCents).toBe(100);
    expect(result.breakdown).toEqual([
      { source: "PAYROLL", amountCents: 300 },
      { source: "POS", amountCents: 100 },
    ]);
  });
});
