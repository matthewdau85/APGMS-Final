import { TaxConfigRepository } from "./tax-config-repository";

type PayPeriod = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "ANNUAL";

interface CalculateInput {
  grossCents: number;
  payPeriod: PayPeriod;
  jurisdiction: string;
  onDate: Date;
}

interface PaygwBracket {
  thresholdCents: number;
  baseCents: number;
  rate: number;
}

export class PaygwEngine {
  constructor(
    private readonly repo: Pick<TaxConfigRepository, "getActiveConfig">,
  ) {}

  async calculate(input: CalculateInput) {
    const { grossCents, payPeriod, jurisdiction, onDate } = input;

    const config = await this.repo.getActiveConfig({
      jurisdiction,
      taxType: "PAYGW",
      onDate,
    });

    if (!config || config.kind !== "PAYGW" || !Array.isArray(config.brackets)) {
      throw new Error(
        "TAX_CONFIG_MISSING: No PAYGW config or brackets found for active parameter set",
      );
    }

    if (grossCents <= 0) {
      return {
        withholding: {
          cents: 0,
          currency: "AUD",
        },
      };
    }

    const annualisedCents = annualise(grossCents, payPeriod);

    const bracket = [...config.brackets]
      .reverse()
      .find((b: PaygwBracket) => annualisedCents >= b.thresholdCents);

    if (!bracket) {
      throw new Error("No PAYGW bracket found");
    }

    const excess = annualisedCents - bracket.thresholdCents;
    const annualTax =
      bracket.baseCents + Math.floor(excess * bracket.rate);

    const perPeriodCents = deannualise(annualTax, payPeriod);

    return {
      withholding: {
        cents: perPeriodCents,
        currency: "AUD",
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    default:
      return cents;
  }
}

function deannualise(cents: number, period: PayPeriod): number {
  switch (period) {
    case "WEEKLY":
      return Math.floor(cents / 52);
    case "FORTNIGHTLY":
      return Math.floor(cents / 26);
    case "MONTHLY":
      return Math.floor(cents / 12);
    case "ANNUAL":
      return cents;
    default:
      return cents;
  }
}
