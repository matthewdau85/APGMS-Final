// packages/domain-policy/src/au-tax/paygw-engine.ts

import type { JurisdictionCode } from "../tax-types.js";
import {
  TaxType,
  type PayPeriod,
  type PaygwConfig,
  type PaygwBracket,
  type TaxConfigRepository,
} from "./types.js";

export interface PaygwCalculationInput {
  jurisdiction: JurisdictionCode;
  payPeriod: PayPeriod;
  paymentDate: Date;
  grossCents: number;
  flags?: Record<string, unknown>;
}

export interface PaygwCalculationResult {
  withholdingCents: number;
  withheldCents: number;
  bracketIndex: number;
  parameterSetId: string;
  configUsed: PaygwConfig;
}

/**
 * Basic PAYGW engine that uses simple thresholded brackets with a base amount
 * plus marginal rates.
 */
export class PaygwEngine {
  constructor(private readonly repo: TaxConfigRepository) {}

  async calculate(input: PaygwCalculationInput): Promise<PaygwCalculationResult> {
    const { jurisdiction, payPeriod, paymentDate, grossCents } = input;

    const config = this.repo.getPaygwConfigForSchedule
      ? await this.repo.getPaygwConfigForSchedule(jurisdiction, payPeriod, paymentDate)
      : await this.repo.getActiveConfig({
          jurisdiction,
          taxType: TaxType.PAYGW,
          onDate: paymentDate,
        });

    // Tests expect /No PAYGW bracket found/ when nothing usable exists.
    if (!config || !config.brackets || config.brackets.length === 0) {
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const match = this.findBracket(config.brackets, grossCents);

    if (!match) {
      // Config exists but does not contain a suitable bracket.
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const { bracket, index: bracketIndex } = match;

    // If the bracket is misconfigured, fall back to zero withholding but
    // still report which bracket was selected.
    if (
      bracket.thresholdCents == null ||
      bracket.baseWithholdingCents == null ||
      bracket.marginalRateMilli == null
    ) {
      return {
        withholdingCents: 0,
        withheldCents: 0,
        bracketIndex,
        parameterSetId: config.meta.id,
        configUsed: config,
      };
    }

    const excessCents = Math.max(0, grossCents - bracket.thresholdCents);
    const variableCents = Math.floor((excessCents * bracket.marginalRateMilli) / 1000);
    const withholdingCents = Math.max(0, bracket.baseWithholdingCents + variableCents);

    return {
      withholdingCents,
      withheldCents: withholdingCents,
      bracketIndex,
      parameterSetId: config.meta.id,
      configUsed: config,
    };
  }

  private findBracket(
    brackets: PaygwBracket[],
    grossCents: number,
  ): { bracket: PaygwBracket; index: number } | undefined {
    let candidate: { bracket: PaygwBracket; index: number } | undefined;

    // Use a stable sort to avoid mutating the original array while ensuring we
    // always evaluate brackets from lowest to highest threshold.
    const ordered = brackets
      .map((bracket, index) => ({ bracket, index }))
      .sort((a, b) => {
        if (a.bracket.thresholdCents === b.bracket.thresholdCents) {
          return a.index - b.index;
        }

        return a.bracket.thresholdCents - b.bracket.thresholdCents;
      });

    for (const entry of ordered) {
      if (grossCents >= entry.bracket.thresholdCents) {
        candidate = entry;
      } else {
        break;
      }
    }

    return candidate;
  }
}
