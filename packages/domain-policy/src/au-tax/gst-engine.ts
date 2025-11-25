import type { BasPeriodId } from "./bas-types";

export interface GstConfig {
  rateMilli: number; // 10000 = 10% for 10%
}

export interface PosTransaction {
  orgId: string;
  basPeriodId: BasPeriodId;
  txId: string;
  txDate: Date;
  grossCents: number;
  taxable: boolean;
}

export interface GstCalculationResult {
  txId: string;
  gstCents: number;
}

export class GstEngine {
  constructor(private readonly config: GstConfig) {}

  calculate(tx: PosTransaction): GstCalculationResult {
    if (!tx.taxable) {
      return { txId: tx.txId, gstCents: 0 };
    }
    const gstCents = Math.floor((tx.grossCents * this.config.rateMilli) / 100_000);
    return { txId: tx.txId, gstCents };
  }
}
