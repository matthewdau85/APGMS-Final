// services/api-gateway/src/routes/regulator-compliance-summary.ts

import type { FastifyInstance } from "fastify";
import {
  computeOrgObligationsForPeriod,
  getLedgerBalanceForPeriod,
  // NOTE: you must export this from @apgms/domain-policy (see patch note below)
  runBasOutcomeV1FromContext,
} from "@apgms/domain-policy";
import {
  RegulatorComplianceSummaryQuerySchema,
  RegulatorComplianceSummaryReplySchema,
} from "./schemas.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";
type CoverageStatus = "OK" | "WARNING" | "ALERT";

function riskBandFromCoverage(r: number): RiskBand {
  if (r >= 0.95) return "LOW";
  if (r >= 0.8) return "MEDIUM";
  return "HIGH";
}

function coverageStatusFromRatio(r: number): CoverageStatus {
  if (r >= 0.95) return "OK";
  if (r >= 0.8) return "WARNING";
  return "ALERT";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function safeGetByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (!isRecord(cur)) return undefined;
    if (!(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function pickNumber(obj: unknown, paths: string[], fallback: number): number {
  for (const p of paths) {
    const v = safeGetByPath(obj, p);
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return fallback;
}

function pickString<T extends string>(obj: unknown, paths: string[], fallback: T): T {
  for (const p of paths) {
    const v = safeGetByPath(obj, p);
    if (typeof v === "string") return v as T;
  }
  return fallback;
}

export async function registerRegulatorComplianceSummaryRoutes(app: FastifyInstance) {
  app.get(
    "/regulator/compliance/summary",
    {
      schema: {
        querystring: RegulatorComplianceSummaryQuerySchema,
        response: { 200: RegulatorComplianceSummaryReplySchema },
      },
      preHandler: async (request) => {
        await request.jwtVerify();
      },
    },
    async (request) => {
      const { orgId, periods } = request.query as { orgId: string; periods: string[] };

      const summaries = [];
      for (const period of periods) {
        const obligations = await computeOrgObligationsForPeriod(orgId, period);
        const ledger = await getLedgerBalanceForPeriod(orgId, period);

        const paygwDueCents = obligations.paygwDueCents;
        const gstDueCents = obligations.gstDueCents;

        const totalPaidCents = ledger.balanceCents;
        const totalDueCents = paygwDueCents + gstDueCents;

        const paygwPaidCents = totalDueCents === 0 ? 0 : Math.trunc((totalPaidCents * paygwDueCents) / totalDueCents);
        const gstPaidCents = Math.max(0, totalPaidCents - paygwPaidCents);

        const paygwShortfallCents = Math.max(0, paygwDueCents - paygwPaidCents);
        const gstShortfallCents = Math.max(0, gstDueCents - gstPaidCents);

        const fallbackCoverageRatio = totalDueCents === 0 ? 1 : totalPaidCents / totalDueCents;

        const basFacts = {
          orgId,
          period,
          paygwDueCents,
          gstDueCents,
          paygwPaidCents,
          gstPaidCents,
        };

        let basOutcome: unknown = undefined;
        try {
          basOutcome = runBasOutcomeV1FromContext(basFacts);
        } catch {
          basOutcome = undefined;
        }

        const basCoverageRatio = pickNumber(
          basOutcome,
          ["basCoverageRatio", "derived.basCoverageRatio", "outputs.basCoverageRatio", "result.basCoverageRatio"],
          fallbackCoverageRatio
        );

        const riskBand = pickString<RiskBand>(
          basOutcome,
          ["riskBand", "derived.riskBand", "outputs.riskBand", "result.riskBand"],
          riskBandFromCoverage(basCoverageRatio)
        );

        const coverageStatus = pickString<CoverageStatus>(
          basOutcome,
          ["coverageStatus", "derived.coverageStatus", "outputs.coverageStatus", "result.coverageStatus"],
          coverageStatusFromRatio(basCoverageRatio)
        );

        summaries.push({
          period,

          paygwDueCents,
          gstDueCents,
          paygwPaidCents,
          gstPaidCents,

          paygwShortfallCents,
          gstShortfallCents,

          basCoverageRatio,
          riskBand,
          coverageStatus,
        });
      }

      return { orgId, summaries };
    }
  );
}
