// services/api-gateway/src/routes/regulator-compliance-summary.ts

import type { FastifyInstance } from "fastify";
import {
  computeOrgObligationsForPeriod,
  getLedgerBalanceForPeriod,
  runBasOutcomeV1FromContext,
} from "@apgms/domain-policy";
import {
  RegulatorComplianceSummaryQuerySchema,
  RegulatorComplianceSummaryReplySchema,
} from "./schemas.js";
import { prototypeAdminGuard } from "../guards/prototype-admin.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";
type CoverageStatus = "OK" | "WARNING" | "ALERT";

function toIntCents(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  return 0;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// Keep thresholds aligned with domain-policy bas-outcome tests: 0.9 => LOW, 0.8 => MEDIUM
function riskBandFromCoverage(r: number): RiskBand {
  if (r >= 0.9) return "LOW";
  if (r >= 0.8) return "MEDIUM";
  return "HIGH";
}

function coverageStatusFromRatio(r: number): CoverageStatus {
  if (r >= 0.9) return "OK";
  if (r >= 0.8) return "WARNING";
  return "ALERT";
}

export async function registerRegulatorComplianceSummaryRoutes(app: FastifyInstance) {
  app.get(
    // IMPORTANT: app.ts registers this plugin under prefix "/regulator"
    // so the effective URL becomes "/regulator/compliance/summary"
    "/compliance/summary",
    {
      schema: {
        querystring: RegulatorComplianceSummaryQuerySchema,
        response: { 200: RegulatorComplianceSummaryReplySchema },
      },
      preHandler: prototypeAdminGuard(),
    },
    async (request) => {
      const { orgId, period } = request.query as unknown as { orgId: string; period: string };

      const obligations = await computeOrgObligationsForPeriod(orgId, period);
      const ledger = await getLedgerBalanceForPeriod(orgId, period);

      // domain-policy obligations use paygwCents/gstCents
      const paygwDueCents = toIntCents((obligations as any).paygwCents);
      const gstDueCents = toIntCents((obligations as any).gstCents);

      const paygwHeldCents = toIntCents((ledger as any).PAYGW ?? 0);
      const gstHeldCents = toIntCents((ledger as any).GST ?? 0);

      const totalDueCents = paygwDueCents + gstDueCents;
      const totalHeldCents = paygwHeldCents + gstHeldCents;

      // Deterministic fallback
      let basCoverageRatio = totalDueCents === 0 ? 1 : clamp01(totalHeldCents / totalDueCents);
      let riskBand: RiskBand = riskBandFromCoverage(basCoverageRatio);
      let coverageStatus: CoverageStatus = coverageStatusFromRatio(basCoverageRatio);

      let paygwShortfallCents = Math.max(0, paygwDueCents - paygwHeldCents);
      let gstShortfallCents = Math.max(0, gstDueCents - gstHeldCents);
      let totalShortfallCents = paygwShortfallCents + gstShortfallCents;

      // Prefer the domain-policy outcome if present
      try {
        const out = runBasOutcomeV1FromContext({
          orgId,
          period,
          obligations: { paygwCents: paygwDueCents, gstCents: gstDueCents },
          ledger: { paygwCents: paygwHeldCents, gstCents: gstHeldCents },
        } as any);

        if (out && typeof out === "object" && (out as any).metrics) {
          const m = (out as any).metrics;

          if (typeof m.basCoverageRatio === "number") basCoverageRatio = m.basCoverageRatio;
          if (typeof m.riskBand === "string") riskBand = m.riskBand as RiskBand;
          if (typeof m.coverageStatus === "string") coverageStatus = m.coverageStatus as CoverageStatus;

          if (typeof m.paygwShortfallCents === "number") paygwShortfallCents = m.paygwShortfallCents;
          if (typeof m.gstShortfallCents === "number") gstShortfallCents = m.gstShortfallCents;
          if (typeof m.totalShortfallCents === "number") totalShortfallCents = m.totalShortfallCents;
        }
      } catch {
        // keep fallback
      }

      return {
        orgId,
        period,

        paygwDueCents,
        gstDueCents,
        totalDueCents,

        paygwHeldCents,
        gstHeldCents,
        totalHeldCents,

        paygwShortfallCents,
        gstShortfallCents,
        totalShortfallCents,

        basCoverageRatio,

        // tests look for body.risk.riskBand
        risk: {
          riskBand,
          coverageStatus,
        },
      };
    },
  );
}

/**
 * Back-compat named export (some code/tests import this symbol)
 */
export async function registerRegulatorComplianceSummaryRoute(app: FastifyInstance) {
  await registerRegulatorComplianceSummaryRoutes(app);
}

/**
 * Plugin wrapper + default export (app.ts can register as a plugin)
 */
export async function regulatorComplianceSummaryPlugin(app: FastifyInstance) {
  await registerRegulatorComplianceSummaryRoutes(app);
}
export default regulatorComplianceSummaryPlugin;
