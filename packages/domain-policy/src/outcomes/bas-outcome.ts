// packages/domain-policy/src/outcomes/bas-outcome.ts

import { compileOutcomeSpecV1 } from "./compiler.js";
import { BAS_OUTCOME_SPEC_V1 } from "./specs/bas-outcomes.v1.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

type BasOutcomeParts = {
  orgId: string;
  period: string;
  paygwDueCents: number;
  gstDueCents: number;
  paygwPaidCents: number;
  gstPaidCents: number;
};

type BasOutcomeContextLike =
  | { inputs: BasOutcomeParts; derived?: Record<string, unknown> }
  | BasOutcomeParts;

// Option A: compile once (module scope). Do NOT recompile per call.
const compiled = compileOutcomeSpecV1(BAS_OUTCOME_SPEC_V1);

/**
 * IMPORTANT:
 * - compiler.runOutcome() expects an OutcomeDefinition.id (one of spec.outcomes[*].id)
 * - NOT necessarily spec.id.
 *
 * Choose the primary outcome deterministically:
 * 1) Prefer an outcome whose id equals spec.id (if you use that convention)
 * 2) Else if exactly one outcome exists, use it
 * 3) Else throw with a clear list
 */
const BAS_PRIMARY_OUTCOME_ID: string = (() => {
  const outcomes = Array.isArray((BAS_OUTCOME_SPEC_V1 as any).outcomes)
    ? (BAS_OUTCOME_SPEC_V1 as any).outcomes
    : [];

  const bySpecId = outcomes.find((o: any) => o && o.id === BAS_OUTCOME_SPEC_V1.id);
  if (bySpecId && typeof bySpecId.id === "string") return bySpecId.id;

  if (outcomes.length === 1 && outcomes[0] && typeof outcomes[0].id === "string") {
    return outcomes[0].id;
  }

  const ids = outcomes.map((o: any) => (o && o.id ? String(o.id) : "<missing>")).join(", ");
  throw new Error(
    `BAS_OUTCOME_SPEC_V1: cannot choose primary outcome. spec.id=${BAS_OUTCOME_SPEC_V1.id}; outcomes=[${ids}]`
  );
})();

function toIntCents(n: unknown): number {
  const x = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.trunc(x);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function runBasOutcomeV1FromContext(ctx: BasOutcomeContextLike) {
  const inputs: BasOutcomeParts =
    typeof ctx === "object" && ctx !== null && "inputs" in (ctx as any)
      ? ((ctx as any).inputs as BasOutcomeParts)
      : (ctx as any);

  const paygwDueCents = toIntCents(inputs.paygwDueCents);
  const gstDueCents = toIntCents(inputs.gstDueCents);
  const paygwPaidCents = toIntCents(inputs.paygwPaidCents);
  const gstPaidCents = toIntCents(inputs.gstPaidCents);

  const paygwShortfallCents = Math.max(0, paygwDueCents - paygwPaidCents);
  const gstShortfallCents = Math.max(0, gstDueCents - gstPaidCents);
  const totalShortfallCents = paygwShortfallCents + gstShortfallCents;

  const totalDueCents = paygwDueCents + gstDueCents;
  const totalPaidCents = paygwPaidCents + gstPaidCents;

  const basCoverageRatio = totalDueCents === 0 ? 1 : clamp01(totalPaidCents / totalDueCents);

  const priorDerived =
    typeof ctx === "object" &&
    ctx !== null &&
    "derived" in (ctx as any) &&
    (ctx as any).derived &&
    typeof (ctx as any).derived === "object"
      ? ((ctx as any).derived as Record<string, unknown>)
      : {};

  /**
   * Context contract:
   * Spec references paths like:
   * - obligations.paygwCents
   * - ledger.paygwCents
   *
   * So we provide:
   * - obligations/payments/shortfall/coverage (structured)
   * - ledger (alias namespace for specs that expect ledger.*)
   * - inputs/derived (back-compat)
   */
  const fullCtx = {
    orgId: inputs.orgId,
    period: inputs.period,

    // Primary structured paths
    obligations: {
      paygwCents: paygwDueCents,
      gstCents: gstDueCents,
      totalCents: totalDueCents,
    },
    payments: {
      paygwCents: paygwPaidCents,
      gstCents: gstPaidCents,
      totalCents: totalPaidCents,
    },
    shortfall: {
      paygwCents: paygwShortfallCents,
      gstCents: gstShortfallCents,
      totalCents: totalShortfallCents,
    },
    coverage: {
      ratio: basCoverageRatio,
    },

    // Alias namespace (spec currently expects ledger.*)
    ledger: {
      // due/obligation
      paygwCents: paygwDueCents,
      gstCents: gstDueCents,
      totalCents: totalDueCents,

      // paid
      paygwPaidCents,
      gstPaidCents,
      totalPaidCents,

      // shortfall
      paygwShortfallCents,
      gstShortfallCents,
      totalShortfallCents,

      // coverage
      basCoverageRatio,
      coverageRatio: basCoverageRatio,
    },

    // Existing inputs
    inputs: {
      ...inputs,
      paygwDueCents,
      gstDueCents,
      paygwPaidCents,
      gstPaidCents,
    },

    // Existing derived (+aliases)
    derived: {
      ...priorDerived,

      paygwShortfallCents,
      gstShortfallCents,
      totalShortfallCents,

      totalDueCents,
      totalPaidCents,
      basCoverageRatio,

      coverageRatio: basCoverageRatio,
    },
  };

  return compiled.runOutcome(BAS_PRIMARY_OUTCOME_ID, fullCtx) as {
    outcomeId: string;
    domain: string;
    version: string;
    metrics: {
      paygwShortfallCents: number;
      gstShortfallCents: number;
      totalShortfallCents: number;
      basCoverageRatio: number;
      riskBand: RiskBand;
    };
    hash: string;
    evidence?: unknown;
    taxSpec?: unknown;
  };
}
