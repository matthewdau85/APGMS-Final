// packages/domain-policy/src/risk/anomaly.ts

import { PrismaClient } from "@prisma/client";
import { verifyLedgerChain } from "../ledger/tax-ledger";

const prisma = new PrismaClient();

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface OrgRiskSnapshot {
  orgId: string;
  period: string;
  bufferCoveragePct: number;
  fundingConsistencyPct: number;
  overallLevel: RiskLevel;
  // 🔐 Optional ledger integrity signal
  ledgerIntegrity?: {
    ok: boolean;
    firstInvalidIndex?: number;
    reason?: string;
  };
}

export async function computeOrgRisk(
  orgId: string,
  period: string,
): Promise<OrgRiskSnapshot> {
  // Very simple placeholder logic.
  // TODO: plug into real obligations + buffers using prisma.
  const bufferCoveragePct = 80; // e.g., 80% of required PAYGW+GST is covered
  const fundingConsistencyPct = 70; // e.g., % of weeks adequately funded

  let overallLevel: RiskLevel = "LOW";
  if (bufferCoveragePct < 90 || fundingConsistencyPct < 80) {
    overallLevel = "MEDIUM";
  }
  if (bufferCoveragePct < 70 || fundingConsistencyPct < 60) {
    overallLevel = "HIGH";
  }

  const snapshot: OrgRiskSnapshot = {
    orgId,
    period,
    bufferCoveragePct,
    fundingConsistencyPct,
    overallLevel,
  };

  // 🔐 Ledger integrity (optional if period is blank)
  if (period) {
    const ledgerIntegrity = await verifyLedgerChain(orgId, period);
    snapshot.ledgerIntegrity = ledgerIntegrity;

    // Optionally bump LOW → MEDIUM if chain is broken
    if (!ledgerIntegrity.ok && snapshot.overallLevel === "LOW") {
      snapshot.overallLevel = "MEDIUM";
    }
  }

  return snapshot;
}
