// packages/domain-policy/src/au-tax/paygw-engine.ts

import {
  JurisdictionCode,
  PaygwBracket,
  PaygwConfig,
  TaxConfigRepository,
  TaxType,
} from "./types";

export interface PaygwCalculationInput {
  jurisdiction: JurisdictionCode; // "AU"
  paymentDate: Date;
  // Gross pay for the period in whole cents.
  grossCents: number;
  // Periodicity, used only to resolve the right AU tax table in data.
  payPeriod: "weekly" | "fortnightly" | "monthly" | "quarterly" | "annual";
  // Optional flags for HELP/STSL etc. These must be interpreted via config flags.
  flags?: {
    hasHelpDebt?: boolean;
    hasStslDebt?: boolean;
    medicareExempt?: boolean;
    [key: string]: boolean | string | number | undefined;
  };
}

export interface PaygwCalculationResult {
  withholdingCents: number;
  // Trace of which bracket and parameter set was used.
  parameterSetId: string;
  bracketIndex: number;
}

/**
 * AU PAYGW engine that is entirely driven by TaxParameterSet and
 * TaxRateSchedule rows in the database.
 *
 * No numeric rates or thresholds are hard-coded here.
 */
export class PaygwEngine {
  private readonly configRepo: TaxConfigRepository;

  constructor(configRepo: TaxConfigRepository) {
    this.configRepo = configRepo;
  }

  async calculate(input: PaygwCalculationInput): Promise<PaygwCalculationResult> {
    const { jurisdiction, paymentDate } = input;

    const config = await this.configRepo.getActiveConfig({
      jurisdiction,
      taxType: TaxType.PAYGW,
      onDate: paymentDate,
    });

    const paygwConfig = this.assertPaygwConfig(config);

    const bracketIndex = this.findBracketIndex(
      paygwConfig.brackets,
      input.grossCents
    );

    if (bracketIndex < 0) {
      throw new Error(
        `No PAYGW bracket found for grossCents=${input.grossCents} in parameter set ${paygwConfig.meta.id}`
      );
    }

    const bracket = paygwConfig.brackets[bracketIndex];

    const withholdingCents = this.applyBracket(bracket, input.grossCents);

    return {
      withholdingCents,
      parameterSetId: paygwConfig.meta.id,
      bracketIndex,
    };
  }

  private assertPaygwConfig(config: unknown): PaygwConfig {
    const typed = config as PaygwConfig;
    if (!typed.meta || !Array.isArray(typed.brackets)) {
      throw new Error("Invalid PAYGW config returned from repository");
    }
    return typed;
  }

  private findBracketIndex(
    brackets: PaygwBracket[],
    grossCents: number
  ): number {
    // Brackets are expected to be sorted ascending by thresholdCents.
    let index = -1;
    for (let i = 0; i < brackets.length; i += 1) {
      if (grossCents >= brackets[i].thresholdCents) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }

  private applyBracket(bracket: PaygwBracket, grossCents: number): number {
    const excessCents = Math.max(
      0,
      grossCents - bracket.thresholdCents
    );

    // milli-rate is rate * 1000, so divide by 1000 to obtain the fractional rate.
    const variableComponent = Math.floor(
      (excessCents * bracket.marginalRateMilli) / 1000
    );

    const rawWithholding = bracket.baseWithholdingCents + variableComponent;

    // ATO tables typically round to whole dollars, but that policy belongs
    // in the data layer (i.e. pre-rounded schedule values). Here we only
    // clamp at zero to avoid negative withholding.
    return Math.max(0, rawWithholding);
  }
}
