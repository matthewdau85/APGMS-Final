import type { FastifyInstance } from "fastify";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";
import { obligationsOutstandingCents } from "../metrics/business.js";

import { computeOrgObligationsForPeriod } from
  "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js";
import { getLedgerBalanceForPeriod } from
  "@apgms/domain-policy/ledger/tax-ledger.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

function riskBandFromCoverage(ratio: number, total: number): RiskBand {
  if (total <= 0) return "LOW";
  if (ratio >= 0.9) return "LOW";
  if (ratio >= 0.6) return "MEDIUM";
  return "HIGH";
}

export async function registerRegulatorComplianceSummaryRoute(app: FastifyInstance) {
  app.get(
    "/regulator/compliance/summary",
    {
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
    },
    async (request: any) => {
      const orgId = request.headers["x-org-id"];
      const period = request.query.period;

      if (!orgId) throw Object.assign(new Error("Missing orgId"), { statusCode: 400 });

      const obligations = await computeOrgObligationsForPeriod(orgId, period);
      const ledger = await getLedgerBalanceForPeriod(orgId, period);

      const paygwOblig = Number(obligations?.paygwCents ?? 0);
      const gstOblig = Number(obligations?.gstCents ?? 0);
      const paygwCovered = Number(ledger?.PAYGW ?? 0);
      const gstCovered = Number(ledger?.GST ?? 0);

      const totalOblig = paygwOblig + gstOblig;
      const totalCovered = paygwCovered + gstCovered;

      const paygwShortfallCents = Math.max(0, paygwOblig - paygwCovered);
      const gstShortfallCents = Math.max(0, gstOblig - gstCovered);

      const outstanding = paygwShortfallCents + gstShortfallCents;
      obligationsOutstandingCents.set(outstanding);

      const coverageRatio = totalOblig === 0 ? 1 : totalCovered / totalOblig;

      return {
        orgId,
        period,
        obligations,
        basCoverageRatio: coverageRatio,
        paygwShortfallCents,
        gstShortfallCents,
        risk: {
          riskBand: riskBandFromCoverage(coverageRatio, totalOblig),
        },
      };
    }
  );
}

export const regulatorComplianceSummaryPlugin = async (app: FastifyInstance) => {
  await registerRegulatorComplianceSummaryRoute(app);
};

export default regulatorComplianceSummaryPlugin;
