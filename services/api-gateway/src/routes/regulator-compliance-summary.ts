// services/api-gateway/src/routes/regulator-compliance-summary.ts

import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

import { getLedgerBalanceForPeriod } from "@apgms/domain-policy/ledger/tax-ledger";

/**
 * Shape of the obligations object returned by the domain layer.
 * Adjust this to match your real implementation.
 */
interface PeriodObligations {
  paygwCents: number;
  gstCents: number;
}

/**
 * TODO: Replace this stub with a real domain service call.
 * e.g. import { computeOrgObligationsForPeriod } from "@apgms/domain-policy/obligations";
 */
async function computeOrgObligationsForPeriod(
  _orgId: string,
  _period: string
): Promise<PeriodObligations> {
  // Stub implementation – returns zero obligations so everything appears SAFE.
  // Wire this to your real PAYGW / GST obligations engine.
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
  riskBand: "LOW" | "MEDIUM" | "HIGH";
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
    // Derive org context from decorated request; fall back to demo values if missing.
    const orgId: string =
      (request as any).org?.orgId ?? "org-demo-1";
    const orgName: string =
      (request as any).org?.orgName ?? "Demo Pty Ltd";

    // Period: from querystring, or derive from date / BAS helper as needed.
    const period: string =
      request.query.period ??
      ""; // TODO: derive from BAS period helper (e.g. "2025-Q2" or "2025-05")

    // --- Domain calls ---

    // 1. Tax ledger balances for the period (PAYGW / GST designated accounts).
    const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);
    // Expected shape:
    // {
    //   PAYGW: number; // cents
    //   GST: number;   // cents
    //   // ...other ledgers if present
    // }

    // 2. Statutory obligations for the same period.
    const obligations = await computeOrgObligationsForPeriod(orgId, period);

    // --- Calculations ---

    const paygwDelta = ledgerTotals.PAYGW - obligations.paygwCents;
    const gstDelta = ledgerTotals.GST - obligations.gstCents;

    const paygwShortfallCents = Math.max(
      0,
      obligations.paygwCents - ledgerTotals.PAYGW
    );
    const gstShortfallCents = Math.max(
      0,
      obligations.gstCents - ledgerTotals.GST
    );

    const totalLedgerCents = (ledgerTotals.PAYGW ?? 0) + (ledgerTotals.GST ?? 0);
    const totalObligationCents =
      (obligations.paygwCents ?? 0) + (obligations.gstCents ?? 0);

    const basCoverageRatioRaw =
      totalObligationCents > 0
        ? totalLedgerCents / totalObligationCents
        : 1;

    const basCoverageRatio = Math.max(
      0,
      Math.min(1, basCoverageRatioRaw)
    );

    // Simple risk banding – adjust thresholds once you have real data.
    let riskBand: ComplianceSummaryItem["riskBand"] = "LOW";
    if (basCoverageRatio < 0.7 || paygwShortfallCents > 0 || gstShortfallCents > 0) {
      riskBand = "HIGH";
    } else if (basCoverageRatio < 0.9) {
      riskBand = "MEDIUM";
    }

    // TODO: Wire this to your BAS history / filing status.
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

  // OPTIONAL: If you still want a per-org "raw" compliance snapshot with explicit status per tax,
  // you can also expose the simpler endpoint you sketched originally:
  //
  // app.get(
  //   "/regulator/compliance-summary",
  //   async (request: any, reply) => {
  //     const orgId = request.org?.orgId ?? "org-demo-1";
  //     const period = request.query?.period ?? "";
  //
  //     const ledgerTotals = await getLedgerBalanceForPeriod(orgId, period);
  //     const obligations = await computeOrgObligationsForPeriod(orgId, period);
  //
  //     const paygwDelta = ledgerTotals.PAYGW - obligations.paygwCents;
  //     const gstDelta = ledgerTotals.GST - obligations.gstCents;
  //
  //     return reply.send({
  //       period,
  //       obligations,
  //       ledgerTotals,
  //       status: {
  //         paygw: paygwDelta >= 0 ? "SAFE" : "UNDER_FUNDED",
  //         gst: gstDelta >= 0 ? "SAFE" : "UNDER_FUNDED",
  //       },
  //     });
  //   }
  // );
}
