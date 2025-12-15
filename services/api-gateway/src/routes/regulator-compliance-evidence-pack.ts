import type { FastifyInstance } from "fastify";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";

import { computeOrgObligationsForPeriod } from "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js";
import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

const PERIOD_RE = /^\d{4}-Q[1-4]$/;

function riskBandFromCoverage(coverage: number): RiskBand {
  if (coverage >= 0.9) return "LOW";
  if (coverage >= 0.6) return "MEDIUM";
  return "HIGH";
}

async function validateOrgAndPeriod(req: any, reply: any) {
  const orgId = req.headers?.["x-org-id"];
  if (!orgId) {
    return reply.code(400).send({ error: "missing_org" });
  }

  const period = req.query?.period;
  if (typeof period !== "string" || !PERIOD_RE.test(period)) {
    return reply.code(400).send({ error: "invalid_period" });
  }
}

async function handler(req: any, reply: any) {
  const orgId = String(req.headers["x-org-id"]);
  const actor = String(req.headers["x-actor"] ?? "unknown");
  const period = String(req.query.period);

  const obligations = await computeOrgObligationsForPeriod(orgId, period);
  const ledger = await getLedgerBalanceForPeriod(orgId, period);

  const paygwDue = Number(obligations?.paygwCents ?? 0);
  const gstDue = Number(obligations?.gstCents ?? 0);
  const paygwPaid = Number((ledger as any)?.PAYGW ?? 0);
  const gstPaid = Number((ledger as any)?.GST ?? 0);

  const totalDueCents = paygwDue + gstDue;
  const totalPaidCents = paygwPaid + gstPaid;
  const basCoverageRatio = totalDueCents === 0 ? 1 : totalPaidCents / totalDueCents;

  const paygwShortfallCents = Math.max(0, paygwDue - paygwPaid);
  const gstShortfallCents = Math.max(0, gstDue - gstPaid);
  const riskBand = riskBandFromCoverage(basCoverageRatio);

  return reply.code(200).send({
    version: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: actor,
    orgId,
    period,
    summary: {
      obligations,
      ledger,
      totals: {
        dueCents: totalDueCents,
        paidCents: totalPaidCents,
      },
      basCoverageRatio,
      shortfalls: {
        paygwShortfallCents,
        gstShortfallCents,
      },
      risk: { riskBand },
    },
  });
}

export function registerRegulatorComplianceEvidencePackRoute(app: FastifyInstance): void {
  const routeOpts = {
    preValidation: validateOrgAndPeriod,
    preHandler: prototypeAdminGuard(),
  };

  // Mirror the dual-path strategy used elsewhere to avoid prefix mismatch regressions.
  app.get("/regulator/compliance/evidence-pack", routeOpts as any, handler as any);
  app.get("/compliance/evidence-pack", routeOpts as any, handler as any);
}

export async function regulatorComplianceEvidencePackPlugin(app: FastifyInstance) {
  registerRegulatorComplianceEvidencePackRoute(app);
}

export default regulatorComplianceEvidencePackPlugin;
