// services/api-gateway/src/routes/regulator-compliance-summary.ts

import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { PERIOD_REGEX } from "../schemas/period.js";

// TEMP STUBS – replace with real domain-policy exports when properly exposed

const computeOrgObligationsForPeriod = async (
  orgId: string,
  period: string,
) => {
  // Minimal fake structure – adjust later to match real domain shape
  return {
    orgId,
    period,
    totals: {
      paygw: 0,
      gst: 0,
      super: 0,
    },
    obligations: [],
  };
};

const getLedgerBalanceForPeriod = async (orgId: string, period: string) => {
  // Minimal fake ledger – adjust later once @apgms/ledger or domain-policy exports are wired
  return {
    orgId,
    period,
    openingBalance: 0,
    closingBalance: 0,
    transactions: [],
  };
};

export function registerRegulatorComplianceSummaryRoute(
  app: FastifyInstance,
): void {
  app.get(
    "/compliance/summary",
    {},
    async (request: FastifyRequest, reply: FastifyReply) => {
      const orgId = request.headers["x-org-id"];
      const qs = request.query as { period?: string } | undefined;

      if (!orgId || typeof orgId !== "string") {
        reply
          .code(401)
          .send({ error: { code: "missing_org", message: "x-org-id required" } });
        return;
      }

      const period = qs?.period ?? "";
      if (!PERIOD_REGEX.test(period)) {
        reply.code(400).send({
          error: {
            code: "invalid_period",
            message: "Period must be YYYY-Qn or YYYY-MM",
          },
        });
        return;
      }

      const obligations = await computeOrgObligationsForPeriod(
        orgId as string,
        period,
      );
      const ledger = await getLedgerBalanceForPeriod(orgId as string, period);

      reply.code(200).send({
        orgId,
        period,
        obligations,
        ledger,
      });
    },
  );
}
