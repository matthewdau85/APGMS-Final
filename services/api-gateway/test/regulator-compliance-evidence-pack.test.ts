import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

/**
 * Some guard implementations capture env at module-load time.
 * Set token BEFORE dynamic import of the route module.
 */
const DEFAULT_ADMIN_TOKEN = "admin-token";
process.env.PROTOTYPE_ADMIN_TOKEN ??= DEFAULT_ADMIN_TOKEN;

function prototypeAdminHeaders(): Record<string, string> {
  const token = process.env.PROTOTYPE_ADMIN_TOKEN ?? DEFAULT_ADMIN_TOKEN;
  return {
    authorization: `Bearer ${token}`,
    "x-prototype-admin": "true",
    "x-actor": "admin-1",
    // legacy variants (harmless if ignored)
    "x-prototype-admin-token": token,
    "x-admin": "true",
    "x-role": "admin",
  };
}

async function registerRoute(app: FastifyInstance): Promise<void> {
  const mod: any = await import("../src/routes/regulator-compliance-evidence-pack.js");
  const register =
    mod.registerRegulatorComplianceEvidencePackRoute ??
    mod.regulatorComplianceEvidencePackPlugin ??
    mod.default;

  if (typeof register !== "function") {
    throw new Error("Could not find evidence-pack registrar export.");
  }

  await register(app);
}

import * as obligationsMod from "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js";
import * as ledgerMod from "@apgms/domain-policy/ledger/tax-ledger.js";

describe("regulator compliance evidence pack", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a JSON evidence pack bundle", async () => {
    const app = Fastify();
    await registerRoute(app);
    await app.ready();

    jest
      .spyOn(obligationsMod, "computeOrgObligationsForPeriod")
      .mockResolvedValue({
        paygwCents: 300,
        gstCents: 100,
        breakdown: [
          { source: "PAYROLL", amountCents: 300 },
          { source: "POS", amountCents: 100 },
        ],
      } as any);

    jest.spyOn(ledgerMod, "getLedgerBalanceForPeriod").mockResolvedValue({
      PAYGW: 0,
      GST: 0,
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/regulator/compliance/evidence-pack?period=2025-Q3",
      headers: {
        ...prototypeAdminHeaders(),
        "x-org-id": "org-demo-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body: any = res.json();
    expect(body.version).toBe(1);
    expect(body.orgId).toBe("org-demo-1");
    expect(body.period).toBe("2025-Q3");
    expect(body.summary.basCoverageRatio).toBe(0);
    expect(body.summary.risk.riskBand).toBe("HIGH");

    await app.close();
  });
});
