import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger";

/**
 * Shape of the statutory obligations returned by the domain layer.
 * TODO: replaced once PAYGW/GST engine is completed.
 */
interface PeriodObligations {
  paygwCents: number;
  gstCents: number;
}

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

/**
 * TODO: Replace with real domain call, e.g.
 * import { computeOrgObligationsForPeriod } from "@apgms/domain-policy/obligations";
 */
async function computeOrgObligationsForPeriod(
  _orgId: string,
  _period: string
): Promise<PeriodObligations> {
  return {
    paygwCents: 0,
    gstCents: 0,
  };
}

interface ComplianceSummaryItem {
  orgId: string;
  orgName: string;
  basCoverageRatio: number; // 0–1
  paygwShortfallCents: number;
  gstShortfallCents: number;
  lateBasCount: number;
  riskBand: RiskBand;
}

interface ComplianceSummaryResponse {
  generatedAt: string;
  items: ComplianceSummaryItem[];
}

interface ComplianceSummaryQuerystring {
  period?: string;
}

export async function registerRegulatorComplianceSummaryRoute(
  app: FastifyInstance,
  _config: AppConfig
): Promise<void> {
  app.get<{
    Querystring: ComplianceSummaryQuerystring;
    Reply: ComplianceSummaryResponse;
  }>("/regulator/compliance/summary", async (request, reply) => {
    // Extract decorated org context; fallback for demo/test mode.
    const orgContext = (request as any).org ?? {};
    const orgId = String(orgContext.orgId ?? "org-demo-1");
    const orgName = String(orgContext.orgName ?? "Demo Pty Ltd");

    // Bas period override; real inference coming later.
    const period = request.query.period ?? "";

    // Domain data fetch
    const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);
    const obligations = await computeOrgObligationsForPeriod(orgId, period);

    // Compute actual shortfalls (never negative)
    const paygwShortfallCents = Math.max(
      0,
      obligations.paygwCents - (ledgerTotals.PAYGW ?? 0)
    );
    const gstShortfallCents = Math.max(
      0,
      obligations.gstCents - (ledgerTotals.GST ?? 0)
    );

    // Overall BAS Coverage ratio: Recorded funds / Required
    const totalLedgerCents =
      (ledgerTotals.PAYGW ?? 0) + (ledgerTotals.GST ?? 0);
    const totalObligationCents =
      (obligations.paygwCents ?? 0) + (obligations.gstCents ?? 0);

    const basCoverageRatio =
      totalObligationCents > 0
        ? Math.max(0, Math.min(1, totalLedgerCents / totalObligationCents))
        : 1;

    // Basic risk band logic
    let riskBand: RiskBand = "LOW";
    if (basCoverageRatio < 0.7 || paygwShortfallCents > 0 || gstShortfallCents > 0) {
      riskBand = "HIGH";
    } else if (basCoverageRatio < 0.9) {
      riskBand = "MEDIUM";
    }

    // TODO: Replace once we track BAS filing timeliness
    const lateBasCount = 0;

    const response: ComplianceSummaryResponse = {
      generatedAt: new Date().toISOString(),
      items: [
        {
          orgId,
          orgName,
          basCoverageRatio,
          paygwShortfallCents,
          gstShortfallCents,
          lateBasCount,
          riskBand,
        },
      ],
    };

    return reply.code(200).send(response);
  });
}
