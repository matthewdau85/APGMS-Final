import { buildFastifyApp } from "../src/app.js";

const isProd = process.env.NODE_ENV === "production";

// The service may import this with or without ".js" depending on build output.
// Mock both to be safe.
jest.mock("@apgms/domain-policy/ledger/tax-ledger", () => ({
  getLedgerBalanceForPeriod: async () => ({ PAYGW: 0, GST: 0 }),
}));

jest.mock("@apgms/domain-policy/ledger/tax-ledger.js", () => ({
  getLedgerBalanceForPeriod: async () => ({ PAYGW: 0, GST: 0 }),
}));

(isProd ? describe.skip : describe)("/regulator/compliance/summary e2e", () => {
  it("returns HIGH risk when ledger is empty but obligations exist", async () => {
    const app = buildFastifyApp({ inMemoryDb: true });

    const orgId = "org-1";
    const period = "2025-Q1";

    try {
      // Seed obligations into the SAME db instance the route uses (app.db).
      await (app as any).db.payrollItem.create({
        data: {
          id: "payroll-1",
          orgId,
          period,
          paygwCents: 100_00, // $100.00
        },
      });

      await (app as any).db.gstTransaction.create({
        data: {
          id: "gst-1",
          orgId,
          period,
          gstCents: 50_00, // $50.00
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/regulator/compliance/summary?period=${encodeURIComponent(period)}`,
        headers: {
          "x-org-id": orgId,
          // Keep or remove; not required by the route, but harmless.
          authorization: "Bearer test-token",
        },
      });

      expect(res.statusCode).toBe(200);

      const body: any = res.json();
      expect(body).toBeTruthy();

      // Core assertions (robust across both response shapes)
      expect(body.orgId).toBe(orgId);
      expect(body.period).toBe(period);

      expect(body.obligations?.paygwCents).toBe(100_00);
      expect(body.obligations?.gstCents).toBe(50_00);

      // Ledger is mocked to 0, obligations exist -> coverage should be 0 -> HIGH risk.
      expect(body.basCoverageRatio).toBeCloseTo(0, 5);

      // Some implementations return risk.riskBand, some return riskBand directly.
      const riskBand = body.risk?.riskBand ?? body.riskBand;
      expect(riskBand).toBe("HIGH");

      // If the service includes a ledger block, assert it too.
      if (body.ledger) {
        expect(body.ledger.PAYGW).toBe(0);
        expect(body.ledger.GST).toBe(0);
      }
    } finally {
      await app.close();
    }
  });
});
