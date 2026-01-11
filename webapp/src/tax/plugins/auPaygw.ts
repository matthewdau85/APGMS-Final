import { isWithinEffectiveRange, parseDateOnlyUtc } from "../dateOnly";
import { makeEvidenceRef, type EvidenceRef } from "../evidence";
import type { PluginContext, TaxObligation, TaxPlugin, TaxTypeId } from "../registry";

export type IsoDateOnly = string;

export interface PaygwInput {
  payPeriod: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  grossIncomeMinor: number; // cents
  taxFileNumberProvided: boolean;
  asAt?: IsoDateOnly; // default ctx.asAt
}

type PaygwBracket = {
  thresholdCents: number;
  baseCents: number;
  rate: number;
};

type PaygwParameters = {
  brackets: PaygwBracket[];
  specVersion: string;
};

type EffectiveDated<T> = {
  id: string;
  effectiveFrom: IsoDateOnly;
  effectiveTo?: IsoDateOnly | null;
  value: T;
};

const AU_PAYGW_ID: TaxTypeId = "AU_PAYGW";
const PAY_PERIODS: PaygwInput["payPeriod"][] = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"];

// Canonical engine choice: bracket table (aligns with domain-policy PaygwEngine).
const PAYGW_PARAMETER_SETS: EffectiveDated<PaygwParameters>[] = [
  {
    id: "au-paygw-2025-06",
    effectiveFrom: "2025-06-01",
    effectiveTo: "2025-07-01",
    value: {
      specVersion: "paygw-brackets-v1",
      brackets: [
        { thresholdCents: 0, baseCents: 0, rate: 0.1 },
        { thresholdCents: 5_000_00, baseCents: 50_000, rate: 0.2 },
      ],
    },
  },
  {
    id: "au-paygw-2025-07",
    effectiveFrom: "2025-07-01",
    effectiveTo: null,
    value: {
      specVersion: "paygw-brackets-v2",
      brackets: [
        { thresholdCents: 0, baseCents: 0, rate: 0.12 },
        { thresholdCents: 5_000_00, baseCents: 60_000, rate: 0.22 },
      ],
    },
  },
];

function pickEffective<T>(asAt: IsoDateOnly, sets: EffectiveDated<T>[]): EffectiveDated<T> | null {
  return (
    sets.find((set) =>
      isWithinEffectiveRange(asAt, set.effectiveFrom, set.effectiveTo ?? null)
    ) ?? null
  );
}

function annualise(cents: number, period: PaygwInput["payPeriod"]): number {
  switch (period) {
    case "WEEKLY":
      return cents * 52;
    case "FORTNIGHTLY":
      return cents * 26;
    case "MONTHLY":
      return cents * 12;
  }
}

function deannualise(cents: number, period: PaygwInput["payPeriod"]): number {
  switch (period) {
    case "WEEKLY":
      return Math.floor(cents / 52);
    case "FORTNIGHTLY":
      return Math.floor(cents / 26);
    case "MONTHLY":
      return Math.floor(cents / 12);
  }
}

function addDays(dateOnly: IsoDateOnly, days: number): IsoDateOnly {
  const base = parseDateOnlyUtc(dateOnly);
  const ms = base + days * 24 * 60 * 60 * 1000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const auPaygwPlugin: TaxPlugin<PaygwInput, TaxObligation[]> = {
  id: AU_PAYGW_ID,
  async compute(ctx: PluginContext, input: PaygwInput): Promise<TaxObligation[]> {
    if (!PAY_PERIODS.includes(input.payPeriod)) {
      throw new Error(`Unsupported pay period: ${input.payPeriod}`);
    }
    const asAt = input.asAt ?? ctx.asAt;
    if (!asAt) {
      throw new Error("Missing asAt date for PAYGW calculation");
    }

    const params = pickEffective(asAt, PAYGW_PARAMETER_SETS);
    if (!params) {
      throw new Error(`No PAYGW parameters for ${asAt}`);
    }

    const annualisedGross = annualise(input.grossIncomeMinor, input.payPeriod);
    const adjustedAnnualised = input.taxFileNumberProvided
      ? annualisedGross
      : Math.floor(annualisedGross * 1.05);

    const brackets = [...params.value.brackets].sort(
      (a, b) => a.thresholdCents - b.thresholdCents
    );
    const bracket =
      brackets
        .slice()
        .reverse()
        .find((b) => adjustedAnnualised >= b.thresholdCents) ?? brackets[0];

    const excess = Math.max(0, adjustedAnnualised - bracket.thresholdCents);
    const annualTax = bracket.baseCents + Math.floor(excess * bracket.rate);
    const withholdingMinor = deannualise(annualTax, input.payPeriod);

    // TODO: BAS/withholding schedules. Assume asAt is period end for now.
    const dueDate = addDays(asAt, 7);
    const evidenceRef: EvidenceRef = makeEvidenceRef({
      taxType: AU_PAYGW_ID,
      pluginVersion: "1.0.0",
      configId: params.id,
      specVersion: params.value.specVersion,
      asAt,
    });

    return [
      {
        id: `paygw-${asAt}`,
        type: AU_PAYGW_ID,
        amountCents: withholdingMinor,
        period: asAt,
        dueDate,
        evidenceRef,
      } as TaxObligation & { dueDate: IsoDateOnly; evidenceRef: EvidenceRef },
    ];
  },
};
