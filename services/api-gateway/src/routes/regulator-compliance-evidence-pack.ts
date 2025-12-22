// services/api-gateway/src/routes/regulator-compliance-evidence-pack.ts

import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import {
  computeOrgObligationsForPeriod,
  getLedgerBalanceForPeriod,
  // NOTE: you must export this from @apgms/domain-policy (see patch note below)
  runBasOutcomeV1FromContext,
} from "@apgms/domain-policy";
import {
  RegulatorComplianceEvidencePackQuerySchema,
  RegulatorComplianceEvidencePackReplySchema,
} from "./schemas.js";

function riskBandFromCoverage(r: number): "LOW" | "MEDIUM" | "HIGH" {
  if (r >= 0.95) return "LOW";
  if (r >= 0.8) return "MEDIUM";
  return "HIGH";
}

function coverageStatusFromRatio(r: number): "OK" | "WARNING" | "ALERT" {
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

// Deterministic JSON stringify (stable key ordering)
function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const walk = (v: unknown): unknown => {
    if (v === null) return null;
    const t = typeof v;
    if (t === "number" || t === "string" || t === "boolean") return v;
    if (t === "bigint") return v.toString();
    if (t === "undefined") return null;
    if (t === "function" || t === "symbol") return null;

    if (Array.isArray(v)) return v.map(walk);

    if (isRecord(v)) {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);

      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
      return out;
    }

    return String(v);
  };

  return JSON.stringify(walk(value));
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

export async function registerRegulatorComplianceEvidencePackRoutes(app: FastifyInstance) {
  app.get(
    "/regulator/compliance/evidence-pack",
    {
      schema: {
        querystring: RegulatorComplianceEvidencePackQuerySchema,
        response: { 200: RegulatorComplianceEvidencePackReplySchema },
      },
      preHandler: async (request) => {
        await request.jwtVerify();
      },
    },
    async (request) => {
      const { orgId, period } = request.query as { orgId: string; period: string };

      const obligations = await computeOrgObligationsForPeriod(orgId, period);
      const ledger = await getLedgerBalanceForPeriod(orgId, period);

      const paygwDueCents = obligations.paygwDueCents;
      const gstDueCents = obligations.gstDueCents;

      // Replace these with your real “paid” derivation if your ledger splits PAYGW vs GST.
      // For now, treat ledger.balanceCents as “total paid towards BAS liabilities”.
      const totalPaidCents = ledger.balanceCents;

      // Simple split logic (keeps prior behavior stable). If you already have proper splits, use them instead.
      const totalDueCents = paygwDueCents + gstDueCents;
      const paygwPaidCents = totalDueCents === 0 ? 0 : Math.trunc((totalPaidCents * paygwDueCents) / totalDueCents);
      const gstPaidCents = Math.max(0, totalPaidCents - paygwPaidCents);

      const generatedAt = new Date().toISOString();

      // Canonical “facts” used for the outcome engine
      const basFacts = {
        orgId,
        period,
        paygwDueCents,
        gstDueCents,
        paygwPaidCents,
        gstPaidCents,
      };

      // Run the domain-policy BAS outcome. If it throws, fall back to computed metrics.
      let basOutcome: unknown = undefined;
      try {
        basOutcome = runBasOutcomeV1FromContext(basFacts);
      } catch {
        basOutcome = undefined;
      }

      // Prefer engine outputs if present; otherwise use deterministic fallback.
      const fallbackCoverageRatio = totalDueCents === 0 ? 1 : totalPaidCents / totalDueCents;

      const basCoverageRatio = pickNumber(
        basOutcome,
        [
          "basCoverageRatio",
          "derived.basCoverageRatio",
          "outputs.basCoverageRatio",
          "result.basCoverageRatio",
        ],
        fallbackCoverageRatio
      );

      const riskBand = pickString(
        basOutcome,
        ["riskBand", "derived.riskBand", "outputs.riskBand", "result.riskBand"],
        riskBandFromCoverage(basCoverageRatio)
      );

      const coverageStatus = pickString(
        basOutcome,
        ["coverageStatus", "derived.coverageStatus", "outputs.coverageStatus", "result.coverageStatus"],
        coverageStatusFromRatio(basCoverageRatio)
      );

      const outcomeChecksum =
        basOutcome === undefined ? null : sha256Hex(stableStringify({ basFacts, basOutcome }));

      return {
        orgId,
        period,
        generatedAt,

        paygwDueCents,
        gstDueCents,
        paygwPaidCents,
        gstPaidCents,

        basCoverageRatio,
        riskBand,
        coverageStatus,

        // If your response schema is strict (additionalProperties:false), you must add these fields to the reply schema.
        basOutcome,
        outcomeChecksum,

        notes: [
          "Evidence pack is derived from obligations snapshot and ledger balance for the period.",
          "Paid amounts are currently allocated proportionally across PAYGW vs GST unless a tax-type split is available in the ledger.",
          "Outcome engine output is included (basOutcome) when available; outcomeChecksum is a SHA-256 over {basFacts, basOutcome}.",
        ],
      };
    }
  );
}
