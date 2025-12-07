// services/api-gateway/test/regulator-compliance-summary.e2e.test.ts

import { buildServer } from "../src/app";
import { prisma } from "@apgms/shared/db.js";

// Re-use the simple AppError etc from unit tests if needed
// but for this e2e we mostly rely on the real wiring.

// Minimal auth mock so /regulator scope works without real JWTs
jest.mock("../src/auth", () => {
  const authGuard = (request: any, _reply: any, done: () => void) => {
    // Simulate a normal tenant context
    request.user = { orgId: "org-e2e-1" };
    done();
  };

  const createAuthGuard = () => {
    return (request: any, _reply: any, done: () => void) => {
      // Simulate regulator with a session and also an org context
      (request as any).org = {
        orgId: "org-e2e-1",
        orgName: "E2E Demo Pty Ltd",
      };
      (request as any).regulatorSession = { id: "sess-e2e-1" };
      done();
    };
  };

  return {
    authGuard,
    createAuthGuard,
    REGULATOR_AUDIENCE: "reg-aud-e2e",
  };
});

// If your config module is heavy, you can keep the real one,
// but if needed you can stub it like this:
//
// jest.mock("../src/config", () => ({
//   config: {
//     ...realConfig,
//     env: "test",
//   },
// }));

describe("/regulator/compliance/summary e2e", () => {
  const orgId = "org-e2e-1";
  const period = "2025-Q3";

  beforeAll(async () => {
    // Clean any old test data for this org/period
    // Adjust table/column names to match your Prisma schema.
    await prisma.payrollItem.deleteMany({ where: { orgId } });
    await prisma.gstTransaction.deleteMany({ where: { orgId } });

    // Seed payroll: total PAYGW 300 cents
    await prisma.payrollItem.createMany({
      data: [
        {
          id: "payroll-e2e-1",
          orgId,
          employeeId: "emp-e2e-1",
          payPeriodStart: new Date("2025-07-01"),
          payPeriodEnd: new Date("2025-07-14"),
          grossCents: BigInt(10000),
          paygwCents: BigInt(200), // $2.00
          stslCents: BigInt(0),
          journalId: null,
        },
        {
          id: "payroll-e2e-2",
          orgId,
          employeeId: "emp-e2e-2",
          payPeriodStart: new Date("2025-07-15"),
          payPeriodEnd: new Date("2025-07-28"),
          grossCents: BigInt(15000),
          paygwCents: BigInt(100), // $1.00
          stslCents: BigInt(0),
          journalId: null,
        },
      ],
    });

    // Seed GST: total GST 100 cents
    await prisma.gstTransaction.createMany({
      data: [
        {
          id: "gst-e2e-1",
          orgId,
          sourceRef: "pos-e2e-1",
          txDate: new Date("2025-07-10"),
          netCents: BigInt(900),
          gstCents: BigInt(50),
          code: "GST",
          basPeriodId: null,
        },
        {
          id: "gst-e2e-2",
          orgId,
          sourceRef: "pos-e2e-2",
          txDate: new Date("2025-07-20"),
          netCents: BigInt(900),
          gstCents: BigInt(50),
          code: "GST",
          basPeriodId: null,
        },
      ],
    });
  });

  afterAll(async () => {
    // Clean up seeded data so you don't pollute dev DB
    await prisma.payrollItem.deleteMany({ where: { orgId } });
    await prisma.gstTransaction.deleteMany({ where: { orgId } });
  });

  it("returns a summary with HIGH risk when ledger is empty but obligations exist", async () => {
    const app = await buildServer();

    const res = await app.inject({
      method: "GET",
      url: `/regulator/compliance/summary?period=${encodeURIComponent(
        period,
      )}`,
      headers: {
        // Any non-empty auth header will satisfy our mocked guards
        Authorization: "Bearer e2e-token",
      },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as any;

    expect(body).toMatchObject({
      orgId,
      period,
      obligations: {
        paygwCents: expect.any(Number),
        gstCents: expect.any(Number),
      },
      ledgerTotals: {
        PAYGW: 0,
        GST: 0,
      },
      paygwShortfallCents: expect.any(Number),
      gstShortfallCents: expect.any(Number),
      basCoverageRatio: expect.any(Number),
      riskBand: "HIGH",
    });

    // With our seed, obligations should be > 0, ledger 0 => coverage 0
    expect(body.basCoverageRatio).toBe(0);
    expect(body.obligations.paygwCents).toBeGreaterThan(0);
    expect(body.obligations.gstCents).toBeGreaterThan(0);

    await app.close();
  });
});
