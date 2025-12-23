// services/api-gateway/src/routes/regulator-compliance-evidence-pack.ts

import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import {
  computeOrgObligationsForPeriod,
  getLedgerBalanceForPeriod,
  runBasOutcomeV1FromContext,
} from "@apgms/domain-policy";
import {
  RegulatorComplianceEvidencePackQuerySchema,
  RegulatorComplianceEvidencePackReplySchema,
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

// Deterministic JSON stringify (stable key ordering)
function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const walk = (v: unknown): unknown => {
    if (v === null || v === undefined) return null;

    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "bigint") return v.toString();
    if (typeof v === "function" || typeof v === "symbol") return null;

    if (Array.isArray(v)) return v.map(walk);

    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (seen.has(o)) return "[Circular]";
      seen.add(o);

      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o).sort()) out[k] = walk(o[k]);
      return out;
    }

    return null;
  };

  return JSON.stringify(walk(value));
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function computeEvidenceChecksum(pack: Record<string, unknown>): string {
  const clone: Record<string, unknown> = { ...pack };
  delete clone.evidenceChecksum;
  return sha256Hex(stableStringify(clone));
}

export async function registerRegulatorComplianceEvidencePackRoutes(app: FastifyInstance) {
  app.get(
    // IMPORTANT: app.ts registers this plugin under prefix "/regulator"
    // so the effective URL becomes "/regulator/compliance/evidence-pack"
    "/compliance/evidence-pack",
    {
      schema: {
        querystring: RegulatorComplianceEvidencePackQuerySchema,
        response: { 200: RegulatorComplianceEvidencePackReplySchema },
      },
      preHandler: prototypeAdminGuard(),
    },
    async (request) => {
      const { orgId, period } = request.query as unknown as { orgId: string; period: string };

      const obligations = await computeOrgObligationsForPeriod(orgId, period);
      const ledger = await getLedgerBalanceForPeriod(orgId, period);

      const paygwDueCents = toIntCents((obligations as any).paygwCents);
      const gstDueCents = toIntCents((obligations as any).gstCents);

      const paygwHeldCents = toIntCents((ledger as any).PAYGW ?? 0);
      const gstHeldCents = toIntCents((ledger as any).GST ?? 0);

      const totalDueCents = paygwDueCents + gstDueCents;
      const totalHeldCents = paygwHeldCents + gstHeldCents;

      let basCoverageRatio = totalDueCents === 0 ? 1 : clamp01(totalHeldCents / totalDueCents);
      let riskBand: RiskBand = riskBandFromCoverage(basCoverageRatio);
      let coverageStatus: CoverageStatus = coverageStatusFromRatio(basCoverageRatio);

      const paygwShortfallCents = Math.max(0, paygwDueCents - paygwHeldCents);
      const gstShortfallCents = Math.max(0, gstDueCents - gstHeldCents);
      const totalShortfallCents = paygwShortfallCents + gstShortfallCents;

      const generatedAt = new Date().toISOString();

      const basFacts = {
        orgId,
        period,
        obligations: { paygwCents: paygwDueCents, gstCents: gstDueCents },
        ledger: { paygwCents: paygwHeldCents, gstCents: gstHeldCents },
      };

      let basOutcome: unknown = undefined;
      try {
        basOutcome = runBasOutcomeV1FromContext(basFacts as any);

        if (basOutcome && typeof basOutcome === "object" && (basOutcome as any).metrics) {
          const m = (basOutcome as any).metrics;
          if (typeof m.basCoverageRatio === "number") basCoverageRatio = m.basCoverageRatio;
          if (typeof m.riskBand === "string") riskBand = m.riskBand as RiskBand;
          if (typeof m.coverageStatus === "string") coverageStatus = m.coverageStatus as CoverageStatus;
        }
      } catch {
        basOutcome = undefined;
      }

      const inputHash = sha256Hex(stableStringify({ orgId, period, obligations, ledger }));
      const outputHash = sha256Hex(
        stableStringify({
          basFacts,
          basOutcome,
          computed: {
            paygwDueCents,
            gstDueCents,
            paygwHeldCents,
            gstHeldCents,
            paygwShortfallCents,
            gstShortfallCents,
            basCoverageRatio,
            riskBand,
            coverageStatus,
          },
        }),
      );

      const outcomeChecksum =
        basOutcome === undefined ? null : sha256Hex(stableStringify({ basFacts, basOutcome }));

      const pack: Record<string, unknown> = {
        version: 1,
        generatedAt,

        orgId,
        period,

        // Optional fields (fill later if you have proper spec identity)
        specIdFull: "bas-outcome-spec-v1",
        specVersionHash: null,

        inputHash,
        outputHash,

        payload: {
          obligations: {
            paygwDueCents,
            gstDueCents,
            totalDueCents,
          },
          ledger: {
            paygwHeldCents,
            gstHeldCents,
            totalHeldCents,
          },
          shortfall: {
            paygwShortfallCents,
            gstShortfallCents,
            totalShortfallCents,
          },
          coverage: {
            basCoverageRatio,
            riskBand,
            coverageStatus,
          },
          basOutcome,
          outcomeChecksum,
        },
      };

      pack.evidenceChecksum = computeEvidenceChecksum(pack);

      return pack;
    },
  );
}

/**
 * Back-compat export (tests may import this symbol)
 */
export async function registerRegulatorComplianceEvidencePackRoute(app: FastifyInstance) {
  await registerRegulatorComplianceEvidencePackRoutes(app);
}

/**
 * Plugin wrapper + default export
 */
export async function regulatorComplianceEvidencePackPlugin(app: FastifyInstance) {
  await registerRegulatorComplianceEvidencePackRoutes(app);
}
export default regulatorComplianceEvidencePackPlugin;
