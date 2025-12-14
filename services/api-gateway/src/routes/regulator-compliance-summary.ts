import type { FastifyInstance } from "fastify";

import { computeOrgObligationsForPeriod } from "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js";
import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger.js";

type RiskBand = "LOW" | "MEDIUM" | "HIGH" | string;

function toInt(v: any): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (t !== "" && /^-?\d+(\.\d+)?$/.test(t)) return Math.trunc(Number(t));
  }
  return 0;
}

// ----- Separate readers (critical) -----
function readPaygwObligation(o: any): number {
  const x =
    o?.paygwCents ??
    o?.paygwDueCents ??
    o?.paygwObligationCents ??
    o?.paygwTotalCents ??
    o?.PAYGW ??
    o?.paygw;
  return toInt(x);
}

function readGstObligation(o: any): number {
  const x =
    o?.gstCents ??
    o?.gstDueCents ??
    o?.gstObligationCents ??
    o?.gstTotalCents ??
    o?.GST ??
    o?.gst;
  return toInt(x);
}

// ✅ FIX: accept PAYGW / GST for paid amounts
function readPaygwPaid(o: any): number {
  const x =
    o?.paygwPaidCents ??
    o?.paygwRemittedCents ??
    o?.paygwPaid ??
    o?.paygwRemitted ??
    o?.paidPaygwCents ??
    o?.remittedPaygwCents ??
    o?.PAYGW ??            // ← added
    o?.paygwCents;
  return toInt(x);
}

function readGstPaid(o: any): number {
  const x =
    o?.gstPaidCents ??
    o?.gstRemittedCents ??
    o?.gstPaid ??
    o?.gstRemitted ??
    o?.paidGstCents ??
    o?.remittedGstCents ??
    o?.GST ??              // ← added
    o?.gstCents;
  return toInt(x);
}

function bandForCoverage(c: number): RiskBand {
  if (c >= 0.95) return "LOW";
  if (c >= 0.6) return "MEDIUM";
  return "HIGH";
}

function getOrgId(req: any): string | undefined {
  const q = (req.query ?? {}) as any;
  return (q.orgId ??
    q.org ??
    q.organisationId ??
    q.organizationId ??
    (req.headers as any)["x-org-id"]) as string | undefined;
}

function getPeriod(req: any): string | undefined {
  const q = (req.query ?? {}) as any;
  return (q.period ??
    q.basPeriodId ??
    q.basPeriod ??
    (req.headers as any)["x-period"]) as string | undefined;
}

async function handler(req: any, reply: any) {
  const orgId = getOrgId(req);
  if (!orgId) {
    return reply.code(400).send({ code: "missing_org", error: "missing_org" });
  }

  const period = getPeriod(req);
  if (!period || !/^\d{4}-Q[1-4]$/.test(period)) {
    return reply.code(400).send({ code: "invalid_period", error: "invalid_period" });
  }

  const obRaw: any = await computeOrgObligationsForPeriod(orgId, period);
  const paidRaw: any = await getLedgerBalanceForPeriod(orgId, period);

  const obBase = obRaw?.obligations ?? obRaw?.due ?? obRaw?.totals ?? obRaw ?? {};
  const paidBase = paidRaw?.paid ?? paidRaw?.ledger ?? paidRaw?.balances ?? paidRaw ?? {};

  const paygwCents = readPaygwObligation(obBase);
  const gstCents = readGstObligation(obBase);

  const paygwPaidCents = readPaygwPaid(paidBase);
  const gstPaidCents = readGstPaid(paidBase);

  const totalObligationsCents = paygwCents + gstCents;
  const totalPaidCents = paygwPaidCents + gstPaidCents;

  const basCoverageRatio =
    totalObligationsCents === 0 ? 1 : totalPaidCents / totalObligationsCents;

  const paygwShortfallCents = Math.max(0, paygwCents - paygwPaidCents);
  const gstShortfallCents = Math.max(0, gstCents - gstPaidCents);

  const riskBand = bandForCoverage(basCoverageRatio);

  return reply.send({
    orgId,
    period,
    obligations: {
      paygwCents,
      gstCents,
      breakdown:
        obRaw?.breakdown ?? [
          { source: "PAYROLL", amountCents: paygwCents },
          { source: "POS", amountCents: gstCents },
        ],
    },
    basCoverageRatio,
    paygwShortfallCents,
    gstShortfallCents,
    risk: { riskBand },
  });
}

export function registerRegulatorComplianceSummaryRoute(app: FastifyInstance) {
  app.get("/compliance/summary", handler);
}

export const regulatorComplianceSummaryPlugin = async (app: FastifyInstance) => {
  registerRegulatorComplianceSummaryRoute(app);
};

export const createRegulatorComplianceSummaryPlugin = (_opts?: any) =>
  regulatorComplianceSummaryPlugin;

export default registerRegulatorComplianceSummaryRoute;
