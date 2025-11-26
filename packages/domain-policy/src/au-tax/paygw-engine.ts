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
    const bracketIndex = this.findBracketIndex(sortedBrackets, grossCents);

    if (bracketIndex < 0) {
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const bracket = sortedBrackets[bracketIndex];
    const excessCents = Math.max(0, grossCents - bracket.thresholdCents);
    const variableCents = Math.floor(
      (excessCents * bracket.marginalRateMilli) / 1000
    );

    const withholdingCents = bracket.baseWithholdingCents + variableCents;

    return {
      withholdingCents,
      parameterSetId: config.meta.id,
      bracketIndex,
      configUsed: config,
    };
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
