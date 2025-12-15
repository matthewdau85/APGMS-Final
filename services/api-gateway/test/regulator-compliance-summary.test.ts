import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

/**
 * These routes are prototype-only and sit behind prototypeAdminGuard().
 *
 * IMPORTANT: some guard implementations capture env at module-load time.
 * So we set PROTOTYPE_ADMIN_TOKEN BEFORE dynamically importing the route module.
 */
const DEFAULT_ADMIN_TOKEN = "admin-token";
process.env.PROTOTYPE_ADMIN_TOKEN ??= DEFAULT_ADMIN_TOKEN;

/**
 * Satisfy current + legacy guard behaviors.
 * (We intentionally include multiple headers because guard behavior has changed over time.)
 */
function prototypeAdminHeaders(): Record<string, string> {
  const token = process.env.PROTOTYPE_ADMIN_TOKEN ?? DEFAULT_ADMIN_TOKEN;
  return {
    // common patterns
    authorization: `Bearer ${token}`,
    "x-prototype-admin": "true",
    "x-actor": "admin-1",

    // legacy / alternative patterns some guards look for
    "x-prototype-admin-token": token,
    "x-admin": "true",
    "x-role": "admin",
  };
}

async function registerRoute(app: FastifyInstance): Promise<void> {
  // Dynamic import so env is set before module initialization.
  const mod: any = await import("../src/routes/regulator-compliance-summary.js");

  const register =
    mod.registerRegulatorComplianceSummaryRoute ??
    mod.regulatorComplianceSummaryPlugin ??
    mod.default;

  if (typeof register !== "function") {
    throw new Error(
      "Could not find route registrar in ../src/routes/regulator-compliance-summary.js (expected registerRegulatorComplianceSummaryRoute | regulatorComplianceSummaryPlugin | default).",
    );
  }

  await register(app);
}

// IMPORTANT: import the exact modules the route imports (so our spies affect the handler)
import * as obligationsMod from "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js";
import * as ledgerMod from "@apgms/domain-policy/ledger/tax-ledger";

describe("regulator compliance summary route", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a summary with correct coverage ratio and risk band", async () => {
    const app = Fastify();
    await registerRoute(app);
    await app.ready();

    jest
      .spyOn(obligationsMod, "computeOrgObligationsForPeriod")
      .mockResolvedValue({
        paygwCents: 500,
        gstCents: 500,
        breakdown: [
          { source: "PAYROLL", amountCents: 500 },
          { source: "POS", amountCents: 500 },
        ],
      } as any);

    jest.spyOn(ledgerMod, "getLedgerBalanceForPeriod").mockResolvedValue({
      PAYGW: 450,
      GST: 450,
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q3",
      headers: {
        ...prototypeAdminHeaders(),
        "x-org-id": "org-demo-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body: any = res.json();
    expect(body.period).toBe("2025-Q3");
    expect(body.basCoverageRatio).toBeCloseTo(0.9, 5);
    expect(body.risk?.riskBand).toBeDefined();

    await app.close();
  });

  it("returns LOW risk when total obligations are zero", async () => {
    const app = Fastify();
    await registerRoute(app);
    await app.ready();

    jest
      .spyOn(obligationsMod, "computeOrgObligationsForPeriod")
      .mockResolvedValue({
        paygwCents: 0,
        gstCents: 0,
        breakdown: [],
      } as any);

    jest.spyOn(ledgerMod, "getLedgerBalanceForPeriod").mockResolvedValue({
      PAYGW: 0,
      GST: 0,
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q3",
      headers: {
        ...prototypeAdminHeaders(),
        "x-org-id": "org-demo-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body: any = res.json();
    expect(body.basCoverageRatio).toBe(1);
    expect(body.risk?.riskBand).toBe("LOW");

    await app.close();
  });

  it("returns MEDIUM risk with ~0.8 coverage", async () => {
    const app = Fastify();
    await registerRoute(app);
    await app.ready();

    jest
      .spyOn(obligationsMod, "computeOrgObligationsForPeriod")
      .mockResolvedValue({
        paygwCents: 500,
        gstCents: 500,
        breakdown: [],
      } as any);

    jest.spyOn(ledgerMod, "getLedgerBalanceForPeriod").mockResolvedValue({
      PAYGW: 400,
      GST: 400,
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q3",
      headers: {
        ...prototypeAdminHeaders(),
        "x-org-id": "org-demo-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body: any = res.json();
    expect(body.basCoverageRatio).toBeCloseTo(0.8, 5);
    expect(body.risk?.riskBand).toBe("MEDIUM");

    await app.close();
  });

  it("returns HIGH risk when coverage is around 0.5", async () => {
    const app = Fastify();
    await registerRoute(app);
    await app.ready();

    jest
      .spyOn(obligationsMod, "computeOrgObligationsForPeriod")
      .mockResolvedValue({
        paygwCents: 500,
        gstCents: 500,
        breakdown: [],
      } as any);

    jest.spyOn(ledgerMod, "getLedgerBalanceForPeriod").mockResolvedValue({
      PAYGW: 250,
      GST: 250,
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/summary?period=2025-Q3",
      headers: {
        ...prototypeAdminHeaders(),
        "x-org-id": "org-demo-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body: any = res.json();
    expect(body.basCoverageRatio).toBeCloseTo(0.5, 5);
    expect(body.risk?.riskBand).toBe("HIGH");

    await app.close();
  });
});
