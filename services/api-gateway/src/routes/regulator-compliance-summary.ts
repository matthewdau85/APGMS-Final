import type { FastifyInstance } from "fastify";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";

import { computeOrgObligationsForPeriod } from "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js";
import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

function riskBandFromCoverage(ratio: number, totalObligationsCents: number): RiskBand {
  if (totalObligationsCents <= 0) return "LOW";
  if (ratio >= 0.9) return "LOW";
  if (ratio >= 0.6) return "MEDIUM";
  return "HIGH";
}

function validateOrgAndPeriod(orgId: any, period: any) {
  if (!orgId || typeof orgId !== "string") {
    const err: any = new Error("Missing orgId (expected header x-org-id)");
    err.statusCode = 400;
    throw err;
  }
  if (!period || typeof period !== "string") {
    const err: any = new Error("Missing period query param");
    err.statusCode = 400;
    throw err;
  }
}

export async function registerRegulatorComplianceSummaryRoute(app: FastifyInstance) {
  const handler = async (request: any) => {
    const orgId = request.headers["x-org-id"];
    const period = request.query?.period;

    validateOrgAndPeriod(orgId, period);

    const obligations = await (computeOrgObligationsForPeriod as any)(orgId, period);

    const ledgerBalances = await (getLedgerBalanceForPeriod as any)(orgId, period);
    const paygwCovered = Number(ledgerBalances?.PAYGW ?? 0);
    const gstCovered = Number(ledgerBalances?.GST ?? 0);

    const paygwOblig = Number(obligations?.paygwCents ?? 0);
    const gstOblig = Number(obligations?.gstCents ?? 0);

    const totalOblig = paygwOblig + gstOblig;
    const totalCovered = paygwCovered + gstCovered;

    const basCoverageRatio = totalOblig === 0 ? 1 : totalCovered / totalOblig;

    const paygwShortfallCents = Math.max(0, paygwOblig - paygwCovered);
    const gstShortfallCents = Math.max(0, gstOblig - gstCovered);

    const riskBand = riskBandFromCoverage(basCoverageRatio, totalOblig);

    return {
      orgId,
      period,
      obligations,
      basCoverageRatio,
      paygwShortfallCents,
      gstShortfallCents,
      risk: {
        riskBand,
      },
    };
  };

  const routeOpts = {
    preHandler: prototypeAdminGuard(),
    schema: {
      querystring: {
        type: "object",
        required: ["period"],
        properties: {
          period: { type: "string" },
        },
      },
    },
  };

  // ✅ For prefix-mounted usage: prefix "/regulator" + "/compliance/summary"
  app.get("/compliance/summary", routeOpts as any, handler);

  // ✅ For direct usage/tests: full path
  app.get("/regulator/compliance/summary", routeOpts as any, handler);
}

export const regulatorComplianceSummaryRoutes = registerRegulatorComplianceSummaryRoute;

// Fastify plugin export used by app.ts
export const regulatorComplianceSummaryPlugin = async (app: FastifyInstance) => {
  await registerRegulatorComplianceSummaryRoute(app);
};

export default regulatorComplianceSummaryPlugin;
