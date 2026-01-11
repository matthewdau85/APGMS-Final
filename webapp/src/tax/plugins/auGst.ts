import { isWithinEffectiveRange, parseDateOnlyUtc } from "../dateOnly";
import { makeEvidenceRef, type EvidenceRef } from "../evidence";
import type { PluginContext, TaxObligation, TaxPlugin, TaxTypeId } from "../registry";

export type IsoDateOnly = string;

export interface GstInput {
  basPeriod: "MONTHLY" | "QUARTERLY";
  salesGstMinor: number;
  purchasesGstCreditMinor: number;
  asAt?: IsoDateOnly;
}

type GstParameters = {
  rulesetVersion: string;
  specVersion: string;
};

type EffectiveDated<T> = {
  id: string;
  effectiveFrom: IsoDateOnly;
  effectiveTo?: IsoDateOnly | null;
  value: T;
};

const AU_GST_ID: TaxTypeId = "AU_GST";

const GST_PARAMETER_SETS: EffectiveDated<GstParameters>[] = [
  {
    id: "au-gst-2025-06",
    effectiveFrom: "2025-06-01",
    effectiveTo: "2025-07-01",
    value: { rulesetVersion: "gst-rules-2025-06", specVersion: "gst-rules-v1" },
  },
  {
    id: "au-gst-2025-07",
    effectiveFrom: "2025-07-01",
    effectiveTo: null,
    value: { rulesetVersion: "gst-rules-2025-07", specVersion: "gst-rules-v2" },
  },
];

function pickEffective<T>(asAt: IsoDateOnly, sets: EffectiveDated<T>[]): EffectiveDated<T> | null {
  return (
    sets.find((set) =>
      isWithinEffectiveRange(asAt, set.effectiveFrom, set.effectiveTo ?? null)
    ) ?? null
  );
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

export const auGstPlugin: TaxPlugin<GstInput, TaxObligation[]> = {
  id: AU_GST_ID,
  async compute(ctx: PluginContext, input: GstInput): Promise<TaxObligation[]> {
    const asAt = input.asAt ?? ctx.asAt;
    if (!asAt) {
      throw new Error("Missing asAt date for GST calculation");
    }

    const params = pickEffective(asAt, GST_PARAMETER_SETS);
    if (!params) {
      throw new Error(`No GST parameters for ${asAt}`);
    }

    const net = input.salesGstMinor - input.purchasesGstCreditMinor;
    // TODO: handle GST refunds or credits when net is negative.
    const amountMinor = Math.max(0, net);

    // TODO: BAS/withholding schedules. Assume asAt is period end for now.
    const dueDate = addDays(asAt, 28);
    const evidenceRef: EvidenceRef = makeEvidenceRef({
      taxType: AU_GST_ID,
      pluginVersion: "1.0.0",
      configId: params.id,
      specVersion: params.value.specVersion,
      asAt,
    });

    return [
      {
        id: `gst-${asAt}`,
        type: AU_GST_ID,
        amountCents: amountMinor,
        period: asAt,
        dueDate,
        evidenceRef,
      } as TaxObligation & { dueDate: IsoDateOnly; evidenceRef: EvidenceRef },
    ];
  },
};
