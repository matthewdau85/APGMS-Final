// packages/domain-policy/src/outcomes/bas-outcome.ts

import crypto from "crypto";
import { compileOutcomeSpecV1 } from "./compiler.js";
import { BAS_OUTCOME_SPEC_V1 } from "./specs/bas-outcomes.v1.js";
import { canonicalJson } from "../export/canonicalJson.js";

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";
export type CoverageStatus = "OK" | "WARNING" | "ALERT";

export type BasOutcomeV1RunResult = {
  outcomeId: string;
  domain: string;
  version: string;
  metrics: {
    // Due (obligations)
    paygwDueCents: number;
    gstDueCents: number;
    totalDueCents: number;

    // Held (ledger/buffer)
    paygwHeldCents: number;
    gstHeldCents: number;
    totalHeldCents: number;

    // Paid/remitted (optional; currently defaults to held unless provided)
    paygwPaidCents: number;
    gstPaidCents: number;
    totalPaidCents: number;

    // Shortfalls are computed against HELD
    paygwShortfallCents: number;
    gstShortfallCents: number;
    totalShortfallCents: number;

    basCoverageRatio: number;
    basCoveragePercent: number;

    riskBand: RiskBand;
    coverageStatus: CoverageStatus;
  };
  hash: string;
  evidence?: unknown;
  taxSpec?: unknown;
};

// Back-compat + structured support
export type BasOutcomeContextLike =
  | {
      orgId: string;
      period: string;
      obligations?: { paygwCents?: number; gstCents?: number };
      ledger?: { paygwCents?: number; gstCents?: number };
      payments?: { paygwCents?: number; gstCents?: number };
      inputs?: unknown;
      derived?: Record<string, unknown>;
    }
  | {
      inputs: {
        orgId: string;
        period: string;

        // legacy input names (still accepted)
        paygwDueCents: number;
        gstDueCents: number;
        paygwPaidCents: number;
        gstPaidCents: number;

        // optional newer names
        paygwHeldCents?: number;
        gstHeldCents?: number;

        // structured namespaces (preferred)
        obligations?: { paygwCents?: number; gstCents?: number };
        ledger?: { paygwCents?: number; gstCents?: number };
        payments?: { paygwCents?: number; gstCents?: number };
      };
      derived?: Record<string, unknown>;
    }
  | {
      orgId: string;
      period: string;
      paygwDueCents: number;
      gstDueCents: number;
      paygwPaidCents: number;
      gstPaidCents: number;
      paygwHeldCents?: number;
      gstHeldCents?: number;
      obligations?: { paygwCents?: number; gstCents?: number };
      ledger?: { paygwCents?: number; gstCents?: number };
      payments?: { paygwCents?: number; gstCents?: number };
    };

type Outputs = Record<string, unknown>;

// Compile once (module scope)
const compiled = compileOutcomeSpecV1(BAS_OUTCOME_SPEC_V1);

// Determine primary outcome ID deterministically
const BAS_PRIMARY_OUTCOME_ID: string = (() => {
  const outcomes = Array.isArray((BAS_OUTCOME_SPEC_V1 as any).outcomes)
    ? ((BAS_OUTCOME_SPEC_V1 as any).outcomes as any[])
    : [];

  const bySpecId = outcomes.find((o) => o && o.id === (BAS_OUTCOME_SPEC_V1 as any).id);
  if (bySpecId && typeof bySpecId.id === "string") return bySpecId.id;

  if (outcomes.length === 1 && outcomes[0] && typeof outcomes[0].id === "string") {
    return outcomes[0].id;
  }

  const ids = outcomes.map((o) => (o && o.id ? String(o.id) : "<missing>")).join(", ");
  throw new Error(
    `BAS_OUTCOME_SPEC_V1: cannot choose primary outcome. spec.id=${String(
      (BAS_OUTCOME_SPEC_V1 as any).id
    )}; outcomes=[${ids}]`
  );
})();

function toIntCents(v: unknown): number {
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
  // Matches your tests: 0.9 => LOW, 0.8 => MEDIUM
  if (r >= 0.9) return "LOW";
  if (r >= 0.8) return "MEDIUM";
  return "HIGH";
}

function coverageStatusFromRatio(r: number): CoverageStatus {
  if (r >= 0.9) return "OK";
  if (r >= 0.8) return "WARNING";
  return "ALERT";
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Recompute the same hash strategy used by this wrapper:
 * hash = sha256(canonicalJson(resultWithoutHash))
 */
export function computeBasOutcomeV1Hash(out: BasOutcomeV1RunResult): string {
  const { hash: _hash, ...rest } = out as unknown as Record<string, unknown>;
  const payload = canonicalJson(rest);
  return sha256Hex(payload);
}

export function auditReplayBasOutcomeV1(out: BasOutcomeV1RunResult): void {
  const expected = computeBasOutcomeV1Hash(out);
  if (out.hash !== expected) {
    throw new Error(`BAS outcome hash mismatch: expected=${expected} actual=${out.hash}`);
  }
}

export function runBasOutcomeV1FromContext(
  ctx: BasOutcomeContextLike,
  opts?: { computedAt?: string }
): BasOutcomeV1RunResult {
  const root: any = ctx ?? {};
  const inputs: any =
    root && typeof root === "object" && root.inputs && typeof root.inputs === "object"
      ? root.inputs
      : root;

  const orgId = String(inputs.orgId ?? root.orgId ?? "unknown");
  const period = String(inputs.period ?? root.period ?? "unknown");

  const obligations = inputs.obligations ?? root.obligations ?? {};
  const ledgerIn = inputs.ledger ?? root.ledger ?? {};
  const paymentsIn = inputs.payments ?? root.payments ?? {};

  // Due (obligations)
  const paygwDueCents = toIntCents(obligations.paygwCents ?? inputs.paygwDueCents);
  const gstDueCents = toIntCents(obligations.gstCents ?? inputs.gstDueCents);

  // Held (ledger/buffer). Prefer structured ledger, then explicit held, then legacy paid.
  const paygwHeldCents = toIntCents(
    ledgerIn.paygwCents ?? inputs.paygwHeldCents ?? inputs.paygwPaidCents ?? paymentsIn.paygwCents
  );
  const gstHeldCents = toIntCents(
    ledgerIn.gstCents ?? inputs.gstHeldCents ?? inputs.gstPaidCents ?? paymentsIn.gstCents
  );

  // Paid/remitted (optional) – default to held for now
  const paygwPaidCents = toIntCents(paymentsIn.paygwCents ?? inputs.paygwPaidCents ?? paygwHeldCents);
  const gstPaidCents = toIntCents(paymentsIn.gstCents ?? inputs.gstPaidCents ?? gstHeldCents);

  const totalDueCents = paygwDueCents + gstDueCents;
  const totalHeldCents = paygwHeldCents + gstHeldCents;
  const totalPaidCents = paygwPaidCents + gstPaidCents;

  // Shortfall is due - HELD
  const paygwShortfallCents = Math.max(0, paygwDueCents - paygwHeldCents);
  const gstShortfallCents = Math.max(0, gstDueCents - gstHeldCents);
  const totalShortfallCents = paygwShortfallCents + gstShortfallCents;

  const basCoverageRatio = totalDueCents === 0 ? 1 : clamp01(totalHeldCents / totalDueCents);
  const basCoveragePercent = Math.round(basCoverageRatio * 1000) / 10;

  const riskBand = riskBandFromCoverage(basCoverageRatio);
  const coverageStatus = coverageStatusFromRatio(basCoverageRatio);

  const priorDerived: Record<string, unknown> =
    root && typeof root === "object" && root.derived && typeof root.derived === "object"
      ? (root.derived as Record<string, unknown>)
      : {};

  // MUST include every path the OutcomeSpec references (your earlier failure was missing derived.paygwShortfallCents)
  const fullCtx = {
    orgId,
    period,

    obligations: {
      paygwCents: paygwDueCents,
      gstCents: gstDueCents,
      totalCents: totalDueCents,
    },

    // IMPORTANT: ledger = held (buffer)
    ledger: {
      paygwCents: paygwHeldCents,
      gstCents: gstHeldCents,
      totalCents: totalHeldCents,
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
      percent: basCoveragePercent,
      riskBand,
      status: coverageStatus,
    },

    inputs: {
      ...inputs,
      paygwDueCents,
      gstDueCents,
      paygwHeldCents,
      gstHeldCents,
      paygwPaidCents,
      gstPaidCents,
    },

    derived: {
      ...priorDerived,

      // SPEC-CRITICAL
      paygwShortfallCents,
      gstShortfallCents,
      totalShortfallCents,

      totalDueCents,
      totalHeldCents,
      totalPaidCents,

      basCoverageRatio,
      basCoveragePercent,
      riskBand,
      coverageStatus,
    },
  };

  // Run DSL (for spec conformance / evidence). If it throws, capture as evidence.
  let outputs: Outputs = {};
  try {
    outputs = compiled.runOutcome(BAS_PRIMARY_OUTCOME_ID, fullCtx) as Outputs;
  } catch (e) {
    outputs = { error: (e as Error)?.message ?? "unknown_error" };
  }

  const unsigned: BasOutcomeV1RunResult = {
    outcomeId: BAS_PRIMARY_OUTCOME_ID,
    domain: "BAS",
    version: "v1",
    metrics: {
      paygwDueCents,
      gstDueCents,
      totalDueCents,

      paygwHeldCents,
      gstHeldCents,
      totalHeldCents,

      paygwPaidCents,
      gstPaidCents,
      totalPaidCents,

      paygwShortfallCents,
      gstShortfallCents,
      totalShortfallCents,

      basCoverageRatio,
      basCoveragePercent,

      riskBand,
      coverageStatus,
    },
    hash: "", // filled below
    evidence: {
      specId: (BAS_OUTCOME_SPEC_V1 as any).id ?? "bas-outcome-spec-v1",
      computedAt: opts?.computedAt ?? null,
      ctx: fullCtx,
      outputs,
    },
  };

  const hash = computeBasOutcomeV1Hash(unsigned);

  return { ...unsigned, hash };
}
