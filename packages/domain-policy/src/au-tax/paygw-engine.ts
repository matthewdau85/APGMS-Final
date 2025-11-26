// packages/domain-policy/src/au-tax/paygw-engine.ts

import { TaxType, type PayPeriod, type PaygwBracket, type PaygwConfig, type TaxConfigRepository, type AuTaxConfig } from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";

export interface PaygwCalculationInput {
  jurisdiction: JurisdictionCode;
  /** Date of payment used for schedule selection. */
  paymentDate: Date;
  /** Gross income for the pay period (in cents). */
  grossCents: number;
  /** Pay period label (lowercase). */
  payPeriod: PayPeriod;
  flags?: Record<string, unknown>;
}

export interface PaygwCalculationResult {
  withholdingCents: number;
  withheldCents: number;
  bracketIndex: number;
  parameterSetId: string;
  configUsed: PaygwConfig;
}

function isPaygwConfig(config: AuTaxConfig | null): config is PaygwConfig {
  return (
    !!config &&
    (config as PaygwConfig).meta?.taxType === TaxType.PAYGW &&
    Array.isArray((config as PaygwConfig).brackets)
  );
}

/**
 * PAYGW engine that applies simple base + marginal formulas per bracket.
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

    if (!isPaygwConfig(config)) {
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    if (config.payPeriod && config.payPeriod !== payPeriod) {
      throw new Error("PAYGW config pay period does not match input pay period");
    }

    if (!config.brackets || config.brackets.length === 0) {
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const normalizedGross = Math.max(0, grossCents);

    const bracketIndex = this.findBracketIndex(config.brackets, normalizedGross);

    if (bracketIndex < 0) {
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const bracket = config.brackets[bracketIndex];

    const excess = normalizedGross - bracket.thresholdCents;
    const marginal = Math.floor((excess * bracket.marginalRateMilli) / 1000);
    const withholdingCents = Math.max(0, bracket.baseWithholdingCents + marginal);

    return {
      withholdingCents,
      withheldCents: withholdingCents,
      bracketIndex,
      parameterSetId: config.meta.id,
      configUsed: config,
    };
  }

  private findBracketIndex(brackets: PaygwBracket[], grossCents: number): number {
    let chosenIndex = -1;

    for (let i = 0; i < brackets.length; i += 1) {
      const bracket = brackets[i];
      if (grossCents >= bracket.thresholdCents) {
        if (chosenIndex === -1) {
          chosenIndex = i;
        } else {
          const current = brackets[chosenIndex];
          if (bracket.thresholdCents >= current.thresholdCents) {
            chosenIndex = i;
          }
        }
      }
    }

    return chosenIndex;
  }
}
