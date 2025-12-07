// services/api-gateway/src/routes/regulator-compliance-summary.ts

import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger";
import { computeOrgObligationsForPeriod } from "@apgms/domain-policy/obligations/computeOrgObligationsForPeriod";

type RiskBand = "LOW" | "MEDIUM" | "HIGH";

interface PeriodObligations {
  paygwCents: number;
  gstCents: number;
  breakdown?: {
    source: "PAYROLL" | "POS" | "MANUAL";
    amountCents: number;
  }[];
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
  _config: AppConfig,
): Promise<void> {
  app.get<{
    Querystring: ComplianceSummaryQuerystring;
    Reply: ComplianceSummaryResponse;
  }>("/regulator/compliance/summary", async (request, reply) => {
    const orgContext = (request as any).org ?? {};
    const orgId = String(orgContext.orgId ?? "org-demo-1");
    const orgName = String(orgContext.orgName ?? "Demo Pty Ltd");

    const period = request.query.period ?? "";

    // 1. Ledger balances (PAYGW/GST secure rails)
    const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);

    // 2. Statutory obligations from the domain engine
    const obligations: PeriodObligations = await computeOrgObligationsForPeriod(
      orgId,
      period,
    );

    const paygwShortfallCents = Math.max(
      0,
      (obligations.paygwCents ?? 0) - (ledgerTotals.PAYGW ?? 0),
    );
    const gstShortfallCents = Math.max(
      0,
      (obligations.gstCents ?? 0) - (ledgerTotals.GST ?? 0),
    );

    const totalLedgerCents =
      (ledgerTotals.PAYGW ?? 0) + (ledgerTotals.GST ?? 0);
    const totalObligationCents =
      (obligations.paygwCents ?? 0) + (obligations.gstCents ?? 0);

    const basCoverageRatio =
      totalObligationCents > 0
        ? Math.max(0, Math.min(1, totalLedgerCents / totalObligationCents))
        : 1;

    let riskBand: RiskBand = "LOW";
    if (basCoverageRatio < 0.7 || paygwShortfallCents > 0 || gstShortfallCents > 0) {
      riskBand = "HIGH";
    } else if (basCoverageRatio < 0.9) {
      riskBand = "MEDIUM";
    }

    const lateBasCount = 0; // TODO: hook into BAS lodgment history

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
