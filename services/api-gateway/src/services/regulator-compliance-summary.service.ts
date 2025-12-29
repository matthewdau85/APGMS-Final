// src/services/regulator-compliance-summary.service.ts
import { clamp01, safeDivide, toInt } from "../lib/safe-math.js";

interface Args {
  db: any;
  period: string;
}

export async function computeRegulatorComplianceSummary({ db, period }: Args) {
  // Obligations
  const obligations = await db.obligation?.findMany?.({
    where: { period },
  }) ?? [];

  const paygwCents = obligations
    .filter((o: any) => o.type === "PAYGW")
    .reduce((a: number, o: any) => a + toInt(o.amountCents), 0);

  const gstCents = obligations
    .filter((o: any) => o.type === "GST")
    .reduce((a: number, o: any) => a + toInt(o.amountCents), 0);

  const breakdown = obligations.map((o: any) => ({
    source: o.source,
    amountCents: toInt(o.amountCents),
  }));

  // Ledger settlements
  const settlements = await db.ledgerEntry?.findMany?.({
    where: { period },
  }) ?? [];

  const settledCents = settlements.reduce(
    (a: number, s: any) => a + toInt(s.amountCents),
    0,
  );

  const totalOwed = paygwCents + gstCents;

  const basCoverageRatio = clamp01(
    safeDivide(settledCents, totalOwed),
  );

  let riskBand: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (basCoverageRatio < 0.6) riskBand = "HIGH";
  else if (basCoverageRatio < 0.85) riskBand = "MEDIUM";

  return {
    period,
    obligations: {
      paygwCents,
      gstCents,
      breakdown,
    },
    basCoverageRatio,
    paygwShortfallCents: Math.max(0, paygwCents - settledCents),
    gstShortfallCents: Math.max(0, gstCents - settledCents),
    risk: {
      riskBand,
    },
  };
}
