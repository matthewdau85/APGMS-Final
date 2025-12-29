import { buildFastifyApp } from "../src/app";

const ORG_ID = "org_1";
const PERIOD = "2025-Q3";

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

jest.mock("../src/auth", () => {
  const authGuard = (_req: any, _reply: any, done: () => void) => done();
  return {
    authGuard,
    createAuthGuard: () => authGuard,
    REGULATOR_AUDIENCE: "reg-aud",
  };
});

jest.mock("@apgms/domain-policy/ledger/tax-ledger", () => ({
  getLedgerBalanceForPeriod: jest.fn().mockResolvedValue({
    PAYGW: 0,
    GST: 0,
  }),
}));

// -----------------------------------------------------------------------------
// Test
// -----------------------------------------------------------------------------

describe("/regulator/compliance/summary e2e", () => {
  it("returns HIGH risk when ledger is empty but obligations exist", async () => {
    const app = await buildFastifyApp({ inMemoryDb: true });
    await app.ready();

    // Seed the SAME db instance the service reads from (app.db).
    await (app as any).db.payrollItem.deleteMany({ where: { orgId: ORG_ID, period: PERIOD } });
    await (app as any).db.gstTransaction.deleteMany({ where: { orgId: ORG_ID, period: PERIOD } });

    await (app as any).db.payrollItem.create({
      data: { orgId: ORG_ID, period: PERIOD, paygwCents: 300 },
    });

    await (app as any).db.gstTransaction.create({
      data: { orgId: ORG_ID, period: PERIOD, gstCents: 100 },
    });

    const res = await app.inject({
      method: "GET",
      url: `/regulator/compliance/summary?period=${encodeURIComponent(PERIOD)}`,
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(res.statusCode).toBe(200);

    const body: any = res.json();

    expect(body.orgId).toBe(ORG_ID);
    expect(body.period).toBe(PERIOD);
    expect(body.obligations).toEqual({
      paygwCents: 300,
      gstCents: 100,
      breakdown: [
        { source: "PAYROLL", amountCents: 300 },
        { source: "POS", amountCents: 100 },
      ],
    });

    expect(body.basCoverageRatio).toBe(0);
    expect(body.risk.riskBand).toBe("HIGH");

    await app.close();
  });
});
