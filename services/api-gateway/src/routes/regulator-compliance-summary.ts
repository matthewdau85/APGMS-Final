// services/api-gateway/src/routes/regulator-compliance-summary.ts

import type { FastifyInstance } from "fastify";
import { AppError } from "@apgms/shared";
import { computeOrgObligationsForPeriod } from "@apgms/domain-policy";
import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger";

const PERIOD_REGEX = /^\d{4}-(Q[1-4]|0[1-9]|1[0-2])$/;

function assertValidPeriod(period: unknown): string {
  if (typeof period !== "string" || !PERIOD_REGEX.test(period)) {
    throw new AppError("invalid_period", 400, "invalid_period", { period });
  }
  return period;
}

function classifyRisk(basCoverageRatio: number): "LOW" | "MEDIUM" | "HIGH" {
  if (basCoverageRatio >= 0.9) return "LOW";
  if (basCoverageRatio >= 0.6) return "MEDIUM";
  return "HIGH";
}

export async function registerRegulatorComplianceSummaryRoute(
  app: FastifyInstance,
) {
  // When registered under { prefix: "/regulator" } in app.ts,
  // this becomes: /regulator/compliance/summary
  app.get("/compliance/summary", async (request, reply) => {
    const q = request.query as { period?: string };
    const period = assertValidPeriod(q.period);

    // org context will depend on your auth; for now we accept either:
    const orgId =
      (request as any).org?.orgId ??
      (request as any).user?.orgId ??
      (request.headers["x-org-id"] as string | undefined);

    if (!orgId) {
      throw new AppError("missing_org", 400, "missing_org", {});
    }

    const obligations = await computeOrgObligationsForPeriod(orgId, period);

    const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);
    const paygwSent = ledgerTotals.PAYGW ?? 0;
    const gstSent = ledgerTotals.GST ?? 0;

    const paygwShortfallCents = obligations.paygwCents - paygwSent;
    const gstShortfallCents = obligations.gstCents - gstSent;

    const totalObligation = obligations.paygwCents + obligations.gstCents;
    const totalSent = paygwSent + gstSent;

    const basCoverageRatio =
      totalObligation <= 0 ? 1 : totalSent / totalObligation;

    const riskBand = classifyRisk(basCoverageRatio);

    reply.send({
      orgId,
      period,
      obligations,
      ledgerTotals: {
        PAYGW: paygwSent,
        GST: gstSent,
      },
      paygwShortfallCents,
      gstShortfallCents,
      basCoverageRatio,
      risk: {
        riskBand,
      },
    });
  });
}
