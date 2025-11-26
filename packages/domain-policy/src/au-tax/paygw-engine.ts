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
  orgId: string;
  jurisdiction: JurisdictionCode;
  payPeriod: PayPeriod;
  /** Gross income for the pay period, expressed in cents. */
  grossCents: number;
  /** Payment date for the pay run. */
  paymentDate: Date;
  /** Optional flags from upstream payroll calculations. */
  flags?: Record<string, unknown>;
}

export interface PaygwCalculationResult {
  withholdingCents: number;
  /**
   * Index of the bracket used from the configured PAYGW schedule.
   */
  bracketIndex: number;
  /** Parameter set ID used for the calculation (from config meta). */
  parameterSetId: string;
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

    const config =
      (this.repo.getPaygwConfigForSchedule
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

    const weeklyIncome = this.toWeekly(grossCents, normalizedPeriod);
    const { bracket, index } = this.findBracket(config.brackets, weeklyIncome);

    if (!bracket) {
      throw new Error("No PAYGW bracket found for jurisdiction/period");
    }

    const excess = Math.max(0, weeklyIncome - bracket.thresholdCents);
    const variable = Math.floor((excess * bracket.marginalRateMilli) / 1000);
    const weeklyWithholding = bracket.baseWithholdingCents + variable;
    const withholdingCents = this.fromWeekly(weeklyWithholding, normalizedPeriod);

    return {
      withholdingCents,
      parameterSetId: config.meta.id,
      bracketIndex: index,
      configUsed: config,
    };
  }

  private normalizePeriod(period: PayPeriod): Exclude<
    PayPeriod,
    "weekly" | "fortnightly" | "monthly"
  > {
    switch (period) {
      case "weekly":
        return "WEEKLY";
      case "fortnightly":
        return "FORTNIGHTLY";
      case "monthly":
        return "MONTHLY";
      default:
        return period;
    }
  }

  private toWeekly(amountCents: number, period: PayPeriod): number {
    switch (period) {
      case "WEEKLY":
      case "weekly":
        return amountCents;
      case "FORTNIGHTLY":
      case "fortnightly":
        return amountCents / 2;
      case "MONTHLY":
      case "monthly":
        return (amountCents * 12) / 52;
      default:
        return amountCents;
    }
  }

  private fromWeekly(amountCents: number, period: PayPeriod): number {
    switch (period) {
      case "WEEKLY":
      case "weekly":
        return amountCents;
      case "FORTNIGHTLY":
      case "fortnightly":
        return amountCents * 2;
      case "MONTHLY":
      case "monthly":
        return (amountCents * 52) / 12;
      default:
        return amountCents;
    }
  }

  private findBracket(
    brackets: PaygwBracket[],
    weeklyIncome: number
  ): { bracket: PaygwBracket | undefined; index: number } {
    let chosen: PaygwBracket | undefined;
    let index = -1;

    for (let i = 0; i < brackets.length; i++) {
      const b = brackets[i];
      if (weeklyIncome >= b.thresholdCents) {
        chosen = b;
        index = i;
      } else {
        break;
      }
    }

    return { bracket: chosen, index };
  }
}
