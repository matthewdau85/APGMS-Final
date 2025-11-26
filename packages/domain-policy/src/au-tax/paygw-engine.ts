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
  grossIncomeCents: number;
  asOf: Date;
}

export interface PaygwCalculationResult {
  withheldCents: number;
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
    const { jurisdiction, payPeriod, asOf, grossIncomeCents } = input;

    const config =
      (this.repo.getPaygwConfigForSchedule
        ? await this.repo.getPaygwConfigForSchedule(
            jurisdiction,
            payPeriod,
            asOf
          )
        : ((await this.repo.getActiveConfig({
            jurisdiction,
            taxType: TaxType.PAYGW,
            onDate: asOf,
          })) as PaygwConfig | null));

    if (!config || !config.brackets || config.brackets.length === 0) {
      throw new Error("No PAYGW brackets configured for jurisdiction/period");
    }

    const weeklyIncome = this.toWeekly(grossIncomeCents, payPeriod);
    const bracket = this.findBracket(config.brackets, weeklyIncome);

    if (!bracket || bracket.a == null || bracket.b == null) {
      return { withheldCents: 0, configUsed: config };
    }

    const taxWeekly = weeklyIncome * bracket.a - bracket.b;
    const taxForPeriod = this.fromWeekly(taxWeekly, payPeriod);
    const withheldCents = Math.max(0, Math.round(taxForPeriod));

    return { withheldCents, configUsed: config };
  }

  private toWeekly(amountCents: number, period: PayPeriod): number {
    switch (period) {
      case "WEEKLY":
        return amountCents;
      case "FORTNIGHTLY":
        return amountCents / 2;
      case "MONTHLY":
        return (amountCents * 12) / 52;
      default:
        return amountCents;
    }
  }

  private fromWeekly(amountCents: number, period: PayPeriod): number {
    switch (period) {
      case "WEEKLY":
        return amountCents;
      case "FORTNIGHTLY":
        return amountCents * 2;
      case "MONTHLY":
        return (amountCents * 52) / 12;
      default:
        return amountCents;
    }
  }

  private findBracket(
    brackets: PaygwBracket[],
    weeklyIncome: number
  ): PaygwBracket | undefined {
    for (const b of brackets) {
      if (b.weeklyLessThan == null || weeklyIncome < b.weeklyLessThan) {
        return b;
      }
    }
    return undefined;
  }
}
