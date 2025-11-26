// packages/domain-policy/src/au-tax/paygw-engine.ts

import {
  TaxType,
  type PayPeriod,
  type PaygwBracket,
  type PaygwConfig,
  type TaxConfigRepository,
} from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";

export interface PaygwCalculationInput {
  jurisdiction: JurisdictionCode;
  payPeriod: PayPeriod;
  paymentDate: Date;
  grossCents: number;
  flags?: Record<string, unknown>;
}

export interface PaygwCalculationResult {
  withholdingCents: number;
  parameterSetId: string;
  bracketIndex: number;
  configUsed?: PaygwConfig;
}

/**
 * Basic PAYGW engine that uses ATO "a * X − b" style brackets.
 * Keeps behaviour simple and deterministic for now.
 */
export class PaygwEngine {
  constructor(private readonly repo: TaxConfigRepository) {}

  async calculate(
    input: PaygwCalculationInput
  ): Promise<PaygwCalculationResult> {
    const { jurisdiction, payPeriod, paymentDate, grossCents } = input;

    const normalizedPeriod = this.normalizePeriod(payPeriod);

    const config = (this.repo.getPaygwConfigForSchedule
      ? await this.repo.getPaygwConfigForSchedule(
          jurisdiction,
          normalizedPeriod,
          paymentDate
        )
      : ((await this.repo.getActiveConfig({
          jurisdiction,
          taxType: TaxType.PAYGW,
          onDate: paymentDate,
        })) as PaygwConfig | null));

    if (!config || !config.brackets || config.brackets.length === 0) {
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const sortedBrackets = [...config.brackets].sort(
      (a, b) => a.thresholdCents - b.thresholdCents
    );
    const weeklyGrossCents = this.toWeekly(grossCents, normalizedPeriod);

    const bracketIndex = this.findBracketIndex(sortedBrackets, weeklyGrossCents);

    if (bracketIndex < 0) {
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const bracket = sortedBrackets[bracketIndex];
    const excessCents = Math.max(0, weeklyGrossCents - bracket.thresholdCents);
    const variableCents = Math.floor(
      (excessCents * bracket.marginalRateMilli) / 1000
    );

    const weeklyWithholdingCents =
      bracket.baseWithholdingCents + variableCents;
    const withholdingCents = this.fromWeekly(
      weeklyWithholdingCents,
      normalizedPeriod
    );

    return {
      withholdingCents,
      parameterSetId: config.meta.id,
      bracketIndex,
      configUsed: config,
    };
  }

  private toWeekly(amountCents: number, period: PayPeriod): number {
    const factor = this.weeksPerPeriod(period);
    return amountCents / factor;
  }

  private fromWeekly(amountCents: number, period: PayPeriod): number {
    const factor = this.weeksPerPeriod(period);
    return Math.round(amountCents * factor);
  }

  private weeksPerPeriod(period: PayPeriod): number {
    switch (period) {
      case "FORTNIGHTLY":
        return 2;
      case "MONTHLY":
        // 52 weeks / 12 months = 13/3
        return 13 / 3;
      case "WEEKLY":
      default:
        return 1;
    }
  }

  private normalizePeriod(period: PayPeriod): PayPeriod {
    const upper = period.toString().toUpperCase() as PayPeriod;
    switch (upper) {
      case "WEEKLY":
      case "FORTNIGHTLY":
      case "MONTHLY":
        return upper;
      default:
        return period;
    }
  }

  private findBracketIndex(brackets: PaygwBracket[], grossCents: number): number {
    let currentIndex = -1;

    for (let i = 0; i < brackets.length; i++) {
      const current = brackets[i];
      if (grossCents >= current.thresholdCents) {
        currentIndex = i;
      } else {
        break;
      }
    }

    return currentIndex;
  }
}
