// services/api-gateway/test/regulator-compliance-summary.test.ts

import Fastify from "fastify";
import { registerRegulatorComplianceSummaryRoute } from "../src/routes/regulator-compliance-summary";
import { computeOrgObligationsForPeriod } from "@apgms/domain-policy";
import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger";

// Tell Jest to mock the same modules the route imports
jest.mock("@apgms/domain-policy");
jest.mock("@apgms/domain-policy/ledger/tax-ledger");

// Typed helpers for the mocked functions
const mockedCompute = jest.mocked(computeOrgObligationsForPeriod);
const mockedLedger = jest.mocked(getLedgerBalanceForPeriod);

describe("regulator compliance summary route", () => {
  it("returns a summary with correct coverage ratio and risk band", async () => {
    // Arrange: set up our mock return values
    mockedCompute.mockResolvedValueOnce({
      paygwCents: 10000, // $100.00
      gstCents: 5000,    // $50.00
      breakdown: [
        { source: "PAYROLL", amountCents: 10000 },
        { source: "POS", amountCents: 5000 },
      ],
    });

    mockedLedger.mockResolvedValueOnce({
      PAYGW: 7000, // $70.00
      GST: 3000,   // $30.00
    });

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
    // With coverage ~0.6667 and your thresholds (>=0.9 LOW, >=0.6 MEDIUM, else HIGH)
    expect(body.risk.riskBand).toBe("MEDIUM");

    await app.close();
  });

  it("returns LOW risk when total obligations are zero (coverage forced to 1)", async () => {
    mockedCompute.mockResolvedValueOnce({
      paygwCents: 0,
      gstCents: 0,
      breakdown: [],
    });

    mockedLedger.mockResolvedValueOnce({
      PAYGW: 0,
      GST: 0,
    });

    const app = Fastify();
    await registerRegulatorComplianceSummaryRoute(app as any);
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/compliance/summary?period=2025-Q3",
      headers: {
        "x-org-id": "org-demo-1",
      },
    });

    expect(res.statusCode).toBe(200);

    const body: any = res.json();

    expect(body.period).toBe("2025-Q3");
    expect(body.obligations.paygwCents).toBe(0);
    expect(body.obligations.gstCents).toBe(0);

    // When obligations are zero, we treat coverage as 1.0 (by implementation)
    expect(body.basCoverageRatio).toBe(1);
    expect(body.risk.riskBand).toBe("LOW");
    expect(body.paygwShortfallCents).toBe(0);
    expect(body.gstShortfallCents).toBe(0);

    await app.close();
  });

  it("returns MEDIUM risk with ~0.8 coverage and expected shortfalls", async () => {
    // 1000c due: 600 PAYGW + 400 GST
    mockedCompute.mockResolvedValueOnce({
      paygwCents: 600,
      gstCents: 400,
      breakdown: [
        { source: "PAYROLL", amountCents: 600 },
        { source: "POS", amountCents: 400 },
      ],
    });

    // 800c remitted vs 1000c due => coverage 0.8
    mockedLedger.mockResolvedValueOnce({
      PAYGW: 480, // 80% of PAYGW
      GST: 320,   // 80% of GST
    });

    const app = Fastify();
    await registerRegulatorComplianceSummaryRoute(app as any);
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/compliance/summary?period=2025-Q3",
      headers: {
        "x-org-id": "org-demo-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body: any = res.json();

    // Coverage: (480 + 320) / (600 + 400) = 800 / 1000 = 0.8
    expect(body.basCoverageRatio).toBeCloseTo(0.8, 5);
    expect(body.risk.riskBand).toBe("MEDIUM");

    // Shortfalls are exact (obligations − paid) in your implementation
    expect(body.paygwShortfallCents).toBe(600 - 480); // 120
    expect(body.gstShortfallCents).toBe(400 - 320);   // 80

    await app.close();
  });

  it("returns HIGH risk when coverage is around 0.5", async () => {
    // 1000c due
    mockedCompute.mockResolvedValueOnce({
      paygwCents: 700,
      gstCents: 300,
      breakdown: [
        { source: "PAYROLL", amountCents: 700 },
        { source: "POS", amountCents: 300 },
      ],
    });

    // Only 500c remitted
    mockedLedger.mockResolvedValueOnce({
      PAYGW: 350,
      GST: 150,
    });

    const app = Fastify();
    await registerRegulatorComplianceSummaryRoute(app as any);
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/compliance/summary?period=2025-Q3",
      headers: {
        "x-org-id": "org-demo-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body: any = res.json();

    // Coverage: (350 + 150) / (700 + 300) = 500 / 1000 = 0.5
    expect(body.basCoverageRatio).toBeCloseTo(0.5, 5);
    expect(body.risk.riskBand).toBe("HIGH");

    // Positive shortfalls expected
    expect(body.paygwShortfallCents).toBe(700 - 350); // 350
    expect(body.gstShortfallCents).toBe(300 - 150);   // 150

    await app.close();
  });
});
