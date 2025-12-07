// services/api-gateway/test/regulator-compliance-summary.test.ts

import Fastify from "fastify";
import { registerRegulatorComplianceSummaryRoute } from "../src/routes/regulator-compliance-summary";

// Mock domain functions
jest.mock("@apgms/domain-policy/ledger/tax-ledger", () => ({
  getLedgerBalanceForPeriod: jest.fn().mockResolvedValue({
    PAYGW: 7000, // $70.00
    GST: 3000,   // $30.00
  }),
}));

jest.mock(
  "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod",
  () => ({
    computeOrgObligationsForPeriod: jest.fn().mockResolvedValue({
      paygwCents: 10000, // $100.00
      gstCents: 5000,    // $50.00
      breakdown: [
        { source: "PAYROLL", amountCents: 10000 },
        { source: "POS", amountCents: 5000 },
      ],
    }),
  })
);

describe("regulator compliance summary route", () => {
  it("returns a summary with correct coverage ratio and risk band", async () => {
    const app = Fastify();
    await registerRegulatorComplianceSummaryRoute(app as any, {} as any);
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q3",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      items: Array<{
        orgId: string;
        basCoverageRatio: number;
        paygwShortfallCents: number;
        gstShortfallCents: number;
        riskBand: string;
      }>;
    };

    expect(body.items).toHaveLength(1);
    const item = body.items[0];

    // With mocked data:
    // - Ledger PAYGW:  7000
    // - Ledger GST:    3000
    // - Oblig PAYGW:  10000
    // - Oblig GST:     5000
    //
    // Coverage = (7000+3000)/(10000+5000) = 10000/15000 ≈ 0.6667 -> HIGH
    expect(item.orgId).toBe("org-demo-1");
    expect(item.basCoverageRatio).toBeCloseTo(10000 / 15000);
    expect(item.paygwShortfallCents).toBe(3000); // 10000 - 7000
    expect(item.gstShortfallCents).toBe(2000);   // 5000 - 3000
    expect(item.riskBand).toBe("HIGH");
  });
});
