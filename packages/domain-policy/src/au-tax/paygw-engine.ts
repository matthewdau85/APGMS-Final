// packages/domain-policy/src/au-tax/paygw-engine.ts

import type { TaxConfigRepository, PayPeriod } from "./types.js";
import { TaxType } from "./types.js";
import { computeWithholding } from "./paygw-rounding.js";

export class PaygwEngine {
  constructor(
    private readonly repo: Pick<TaxConfigRepository, "getActiveConfig">,
  ) {}

  async calculate(input: {
    grossCents: number;
    payPeriod: PayPeriod;
    jurisdiction: string;
    onDate: Date;
  }) {
    const { grossCents, payPeriod, jurisdiction, onDate } = input;

    const config = await this.repo.getActiveConfig({
      jurisdiction,
      taxType: TaxType.PAYGW,
      onDate,
    });

    if (!config || config.kind !== "PAYGW") {
      throw new Error("TAX_CONFIG_MISSING");
    }

    if (grossCents <= 0) {
      return { withholding: { cents: 0, currency: "AUD" } };
    }

    const annualised = annualise(grossCents, payPeriod);
    const bracket = [...config.brackets]
      .reverse()
      .find((b) => annualised >= b.thresholdCents);

    if (!bracket) {
      return { withholding: { cents: 0, currency: "AUD" } };
    }

    const excess = annualised - bracket.thresholdCents;
    const annualTax = bracket.baseCents + Math.floor(excess * bracket.rate);

    return {
      withholding: {
        cents: computeWithholding({ annualAmountCents: annualTax, payPeriod }),
        currency: "AUD",
      },
    };
  }
}

function annualise(cents: number, period: PayPeriod): number {
  switch (period) {
    case "WEEKLY":
      return cents * 52;
    case "FORTNIGHTLY":
      return cents * 26;
    case "MONTHLY":
      return cents * 12;
    case "ANNUAL":
      return cents;
  }
}
