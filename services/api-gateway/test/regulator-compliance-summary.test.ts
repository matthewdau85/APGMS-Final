import Fastify from "fastify";
import { registerRegulatorComplianceSummaryRoute } from "../src/routes/regulator-compliance-summary.js";

// IMPORTANT: import the exact modules the route imports
import { computeOrgObligationsForPeriod } from
  "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js";
import { getLedgerBalanceForPeriod } from
  "@apgms/domain-policy/ledger/tax-ledger.js";

// Mock the exact same specifiers (ESM exact-match)
jest.mock(
  "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js",
  () => ({
    computeOrgObligationsForPeriod: jest.fn(),
  }),
);

jest.mock(
  "@apgms/domain-policy/ledger/tax-ledger.js",
  () => ({
    getLedgerBalanceForPeriod: jest.fn(),
  }),
);

// Typed helpers
const mockedCompute = jest.mocked(computeOrgObligationsForPeriod);
const mockedLedger = jest.mocked(getLedgerBalanceForPeriod);

describe("regulator compliance summary route", () => {
  it("returns a summary with correct coverage ratio and risk band", async () => {
    mockedCompute.mockResolvedValueOnce({
      paygwCents: 10000,
      gstCents: 5000,
      breakdown: [
        { source: "PAYROLL", amountCents: 10000 },
        { source: "POS", amountCents: 5000 },
      ],
    });

    mockedLedger.mockResolvedValueOnce({
      PAYGW: 7000,
      GST: 3000,
    });

    const app = Fastify();
    await registerRegulatorComplianceSummaryRoute(app as any);
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/compliance/summary?period=2025-Q3",
      headers: { "x-org-id": "org-demo-1" },
    });

    expect(res.statusCode).toBe(200);

    const body: any = res.json();

    expect(body.basCoverageRatio).toBeCloseTo(10000 / 15000);
    expect(body.paygwShortfallCents).toBe(3000);
    expect(body.gstShortfallCents).toBe(2000);
    expect(body.risk.riskBand).toBe("MEDIUM");

    await app.close();
  });

  it("returns LOW risk when total obligations are zero", async () => {
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
      headers: { "x-org-id": "org-demo-1" },
    });

    const body: any = res.json();

    expect(body.basCoverageRatio).toBe(1);
    expect(body.risk.riskBand).toBe("LOW");

    await app.close();
  });

  it("returns MEDIUM risk with ~0.8 coverage", async () => {
    mockedCompute.mockResolvedValueOnce({
      paygwCents: 600,
      gstCents: 400,
      breakdown: [
        { source: "PAYROLL", amountCents: 600 },
        { source: "POS", amountCents: 400 },
      ],
    });

    mockedLedger.mockResolvedValueOnce({
      PAYGW: 480,
      GST: 320,
    });

    const app = Fastify();
    await registerRegulatorComplianceSummaryRoute(app as any);
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/compliance/summary?period=2025-Q3",
      headers: { "x-org-id": "org-demo-1" },
    });

    const body: any = res.json();

    expect(body.basCoverageRatio).toBeCloseTo(0.8, 5);
    expect(body.risk.riskBand).toBe("MEDIUM");

    await app.close();
  });

  it("returns HIGH risk when coverage is around 0.5", async () => {
    mockedCompute.mockResolvedValueOnce({
      paygwCents: 700,
      gstCents: 300,
      breakdown: [
        { source: "PAYROLL", amountCents: 700 },
        { source: "POS", amountCents: 300 },
      ],
    });

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
      headers: { "x-org-id": "org-demo-1" },
    });

    const body: any = res.json();

    expect(body.basCoverageRatio).toBeCloseTo(0.5, 5);
    expect(body.risk.riskBand).toBe("HIGH");

    await app.close();
  });
});
