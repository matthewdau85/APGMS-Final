// services/api-gateway/test/regulator-compliance-summary.test.ts

import Fastify from "fastify";
import { registerRegulatorComplianceSummaryRoute } from "../src/routes/regulator-compliance-summary";

// Mock ledger totals
jest.mock("@apgms/domain-policy/ledger/tax-ledger", () => ({
  getLedgerBalanceForPeriod: jest.fn().mockResolvedValue({
    PAYGW: 7000, // $70.00
    GST: 3000,   // $30.00
  }),
}));

// ✅ Mock the barrel that the route actually imports
jest.mock("@apgms/domain-policy", () => ({
  computeOrgObligationsForPeriod: jest.fn().mockResolvedValue({
    paygwCents: 10000, // $100.00
    gstCents: 5000,    // $50.00
    breakdown: [
      { source: "PAYROLL", amountCents: 10000 },
      { source: "POS", amountCents: 5000 },
    ],
  }),
}));

describe("regulator compliance summary route", () => {
  it("returns a summary with correct coverage ratio and risk band", async () => {
    const app = Fastify();

    // Register the plugin directly; no /regulator prefix here
    await registerRegulatorComplianceSummaryRoute(app as any);
    await app.ready();

    const res = await app.inject({
      method: "GET",
      // Route is "/compliance/summary" inside the plugin
      url: "/compliance/summary?period=2025-Q3",
      headers: {
        // Needed so your handler doesn't throw missing_org
        "x-org-id": "org-demo-1",
      },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as any;

    expect(body.orgId).toBe("org-demo-1");

    // With mocked data:
    // Ledger: PAYGW 7000, GST 3000 = 10000
    // Obligations: PAYGW 10000, GST 5000 = 15000
    // Coverage = 10000 / 15000 ≈ 0.6667
    expect(body.basCoverageRatio).toBeCloseTo(10000 / 15000);

    expect(body.paygwShortfallCents).toBe(3000); // 10000 - 7000
    expect(body.gstShortfallCents).toBe(2000);   // 5000 - 3000

    // Route wraps risk as { risk: { riskBand } }
    expect(body.risk.riskBand).toBe("MEDIUM");

    await app.close();
  });
});
