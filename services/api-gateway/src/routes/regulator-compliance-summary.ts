import type { FastifyInstance } from "fastify";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";

import { computeOrgObligationsForPeriod } from "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js";
import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger.js";

const PERIOD_RE = /^\d{4}-Q[1-4]$/;

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

function riskBandFromCoverage(coverage: number): RiskBand {
  if (coverage >= 0.9) return "LOW";
  if (coverage >= 0.6) return "MEDIUM";
  return "HIGH";
}

async function validateOrgAndPeriod(req: any, reply: any) {
  const orgId = req.headers?.["x-org-id"];
  if (!orgId) {
    reply.code(400).send({ error: "missing_org" });
    return;
  }

  const period = req.query?.period;
  if (typeof period !== "string" || !PERIOD_RE.test(period)) {
    reply.code(400).send({ error: "invalid_period" });
    return;
  }
}

async function handler(req: any, reply: any) {
  const orgId = String(req.headers["x-org-id"]);
  const period = String(req.query.period);

  const obligations = await computeOrgObligationsForPeriod(orgId, period);
  const ledger = await getLedgerBalanceForPeriod(orgId, period);

  const paygwDue = Number(obligations?.paygwCents ?? 0);
  const gstDue = Number(obligations?.gstCents ?? 0);

  const paygwPaid = Number((ledger as any)?.PAYGW ?? 0);
  const gstPaid = Number((ledger as any)?.GST ?? 0);

  const totalDue = paygwDue + gstDue;
  const totalPaid = paygwPaid + gstPaid;

  const basCoverageRatio = totalDue === 0 ? 1 : totalPaid / totalDue;

  const paygwShortfallCents = Math.max(0, paygwDue - paygwPaid);
  const gstShortfallCents = Math.max(0, gstDue - gstPaid);

  reply.code(200).send({
    orgId,
    period,
    obligations,
    basCoverageRatio,
    paygwShortfallCents,
    gstShortfallCents,
    risk: { riskBand: riskBandFromCoverage(basCoverageRatio) },
  });
}

/**
 * Registers BOTH paths to eliminate prefix/path mismatch regressions:
 * - /regulator/compliance/summary (what your e2e uses)
 * - /compliance/summary (what some unit tests historically used)
 *
 * Guard still applies, and custom 400s happen before guard.
 */
export function registerRegulatorComplianceSummaryRoute(app: FastifyInstance): void {
  const routeOpts = {
    preValidation: validateOrgAndPeriod,
    preHandler: prototypeAdminGuard(),
  };

  app.get("/regulator/compliance/summary", routeOpts as any, handler as any);
  app.get("/compliance/summary", routeOpts as any, handler as any);
}

// Fastify plugin wrapper (existing call-sites keep working)
export async function regulatorComplianceSummaryPlugin(app: FastifyInstance) {
  registerRegulatorComplianceSummaryRoute(app);
}

export default regulatorComplianceSummaryPlugin;
