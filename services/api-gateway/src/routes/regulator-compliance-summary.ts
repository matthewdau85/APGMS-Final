// services/api-gateway/test/regulator-compliance-summary.test.ts

import Fastify from "fastify";
import { registerRegulatorComplianceSummaryRoute } from "../src/routes/regulator-compliance-summary";
import { computeOrgObligationsForPeriod } from "@apgms/domain-policy";
import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger";

// Mock the same modules the route imports
jest.mock("@apgms/domain-policy");
jest.mock("@apgms/domain-policy/ledger/tax-ledger");

const mockedCompute = jest.mocked(computeOrgObligationsForPeriod);
const mockedLedger = jest.mocked(getLedgerBalanceForPeriod);

function buildServer() {
  const app = Fastify();
  registerRegulatorComplianceSummaryRoute(app);
  return app;
}

describe("/regulator/compliance/summary behavioural coverage", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("Case 1: totalObligationCents = 0 -> ratio = 1, riskBand = LOW", async () => {
    const app = buildServer();

    mockedCompute.mockResolvedValueOnce({
      paygwCents: 0,
      gstCents: 0,
    });

    mockedLedger.mockResolvedValueOnce({
      PAYGW: 0,
      GST: 0,
    });

    const res = await app.inject({
      method: "GET",
      url: "/compliance/summary?period=2025-Q1",
      headers: {
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.orgId).toBe("org-1");
    expect(body.period).toBe("2025-Q1");
    expect(body.basCoverageRatio).toBe(1);
    expect(body.risk.riskBand).toBe("LOW");

    await app.close();
  });

  it("Case 2: 0.8 coverage -> riskBand = MEDIUM", async () => {
    const app = buildServer();

    // Obligations: total = 1000
    mockedCompute.mockResolvedValueOnce({
      paygwCents: 600,
      gstCents: 400,
    });

    // Sent: total = 800 -> 0.8 coverage
    mockedLedger.mockResolvedValueOnce({
      PAYGW: 480,
      GST: 320,
    });

    const res = await app.inject({
      method: "GET",
      url: "/compliance/summary?period=2025-Q2",
      headers: {
        "x-org-id": "org-2",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.basCoverageRatio).toBeCloseTo(0.8, 5);
    expect(body.risk.riskBand).toBe("MEDIUM");

    await app.close();
  });

  it("Case 3: 0.5 coverage + PAYGW shortfall -> riskBand = HIGH", async () => {
    const app = buildServer();

    mockedCompute.mockResolvedValueOnce({
      paygwCents: 700,
      gstCents: 300, // total = 1000
    });

    mockedLedger.mockResolvedValueOnce({
      PAYGW: 350,
      GST: 150, // total = 500 -> 0.5 coverage
    });

    const res = await app.inject({
      method: "GET",
      url: "/compliance/summary?period=2025-Q3",
      headers: {
        "x-org-id": "org-3",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.basCoverageRatio).toBeCloseTo(0.5, 5);
    expect(body.risk.riskBand).toBe("HIGH");

    // Explicit PAYGW shortfall present
    expect(body.paygwShortfallCents).toBe(700 - 350); // 350
    expect(body.gstShortfallCents).toBe(300 - 150);   // 150

    await app.close();
  });

  it("rejects invalid period pattern with 400", async () => {
    const app = buildServer();

    const res = await app.inject({
      method: "GET",
      url: "/compliance/summary?period=bad-period",
      headers: {
        "x-org-id": "org-1",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code ?? body.error).toBe("invalid_period");

    await app.close();
  });
});
