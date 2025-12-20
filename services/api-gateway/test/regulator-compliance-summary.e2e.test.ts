// services/api-gateway/test/regulator-compliance-summary.e2e.test.ts

import { buildServer } from "../src/app";

// --- Mocks -------------------------------------------------------------------

// 1) Make regulator auth always allow the request, but still require a header
jest.mock("../src/auth", () => {
  const authGuard = (_req: any, _reply: any, done: () => void) => done();

  return {
    authGuard,
    createAuthGuard: () => authGuard,
    REGULATOR_AUDIENCE: "reg-aud",
  };
});

// 2) Mock obligations domain: we simulate one org with PAYGW 300c + GST 100c
jest.mock("@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js", () => ({
  computeOrgObligationsForPeriod: jest.fn().mockResolvedValue({
    paygwCents: 300,
    gstCents: 100,
    breakdown: [
      { source: "PAYROLL", amountCents: 300 },
      { source: "POS", amountCents: 100 },
    ],
  }),
}));

// 3) Mock ledger totals: no money has yet been remitted to ATO
jest.mock("@apgms/domain-policy/ledger/tax-ledger.js", () => ({
  getLedgerBalanceForPeriod: jest.fn().mockResolvedValue({
    PAYGW: 0,
    GST: 0,
  }),
}));

// --- Test --------------------------------------------------------------------

describe("/regulator/compliance/summary e2e", () => {
  it("returns HIGH risk when ledger is empty but obligations exist", async () => {
    const app = await buildServer();

    const res = await app.inject({
  method: "GET",
  url: "/regulator/compliance/summary?period=2025-Q3",
  headers: {
    "x-org-id": "org-demo-1", // so you don't hit the missing_org AppError
    authorization: "Bearer admin-token",
    "x-prototype-admin": "1",
  },
});

    expect(res.statusCode).toBe(200);

    const body = res.json();

    // Basic smoke expectations
    expect(body.period).toBe("2025-Q3");
    expect(body.obligations).toEqual({
      paygwCents: 300,
      gstCents: 100,
      breakdown: [
        { source: "PAYROLL", amountCents: 300 },
        { source: "POS", amountCents: 100 },
      ],
    });

    // With 0 sent and 400c due, coverage is 0 => high risk
    expect(body.basCoverageRatio).toBe(0);
    expect(body.risk.riskBand).toBe("HIGH");

    await app.close();
  });
});
