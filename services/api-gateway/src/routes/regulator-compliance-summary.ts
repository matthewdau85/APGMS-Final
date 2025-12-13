import type { FastifyInstance } from "fastify";
import { computeOrgObligationsForPeriod } from "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod.js";
import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger.js";

function parseQuarterPeriod(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return /^\d{4}-Q[1-4]$/.test(raw) ? raw : null;
}

function riskBandForCoverage(c: number): "LOW" | "MEDIUM" | "HIGH" {
  if (c >= 0.95) return "LOW";
  if (c >= 0.6) return "MEDIUM";
  return "HIGH";
}

export async function regulatorComplianceSummaryPlugin(app: FastifyInstance): Promise<void> {
  const handler = async (req: any, reply: any) => {
    const orgIdHeader = req.headers["x-org-id"];
    const orgId = orgIdHeader != null ? String(orgIdHeader) : null;
    if (!orgId) return reply.code(400).send({ error: "missing_orgId" });

    const parsed = parseQuarterPeriod(req.query?.period);
    const period = parsed ?? "2025-Q1";

    // Domain obligations (due)
    const obligations = await computeOrgObligationsForPeriod(String(orgId), String(period));
    const obligationsOut = {
      paygwCents: (obligations as any).paygwCents ?? 0,
      gstCents: (obligations as any).gstCents ?? 0,
      breakdown: (obligations as any).breakdown ?? [
        { source: "PAYROLL", amountCents: (obligations as any).paygwCents ?? 0 },
        { source: "POS", amountCents: (obligations as any).gstCents ?? 0 },
      ],
    };

    // Ledger totals (held)
    const ledger = await getLedgerBalanceForPeriod(String(orgId), String(period));
    const paygwHeld = Number((ledger as any).PAYGW ?? (ledger as any).paygwCents ?? 0);
    const gstHeld = Number((ledger as any).GST ?? (ledger as any).gstCents ?? 0);

    const totalDue = obligationsOut.paygwCents + obligationsOut.gstCents;
    const totalHeld = paygwHeld + gstHeld;

    const coverageRatio = totalDue === 0 ? 1 : totalHeld / totalDue;
    const basCoverageRatio = Number(coverageRatio.toFixed(4));
    const band = riskBandForCoverage(basCoverageRatio);

    const paygwShortfallCents = Math.max(0, obligationsOut.paygwCents - paygwHeld);
    const gstShortfallCents = Math.max(0, obligationsOut.gstCents - gstHeld);
    const totalShortfallCents = paygwShortfallCents + gstShortfallCents;

    return reply.code(200).send({
      orgId,
      period,
      obligations: obligationsOut,

      ledger: { paygwCents: paygwHeld, gstCents: gstHeld, totalCents: totalHeld },

      // What the e2e test expects:
      basCoverageRatio,
      risk: { riskBand: band },

      // Backwards-friendly aliases (optional):
      coverageRatio: basCoverageRatio,
      riskBand: band,

      shortfalls: {
        paygwCents: paygwShortfallCents,
        gstCents: gstShortfallCents,
        totalCents: totalShortfallCents,
      },
    });
  };

  app.get("/regulator/compliance/summary", handler);
  app.get("/compliance/summary", handler);
}
