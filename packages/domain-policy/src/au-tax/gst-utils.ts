import type { GstClassification, GstConfig } from "./types.js";

export interface GstLine {
  amountCents: number;
  category: string;
  overrides?: {
    classification?: GstClassification;
  };
}

const DEFAULT_CLASSIFICATION_MAP: Record<string, GstClassification> = {
  general_goods: GstClassification.Taxable,
  gst_free: GstClassification.GstFree,
  exports: GstClassification.InputTaxed,
};

export function classifyItem({
  category,
  overrides,
  config,
}: {
  category: string;
  overrides?: GstLine["overrides"];
  config: GstConfig;
}): GstClassification {
  if (overrides?.classification) {
    return overrides.classification;
  }

  const normalized = String(category).toLowerCase();
  const mapped =
    config.classificationMap?.[normalized] ?? DEFAULT_CLASSIFICATION_MAP[normalized];
  if (mapped) {
    return mapped;
  }

  return GstClassification.Taxable;
}

export function computeGstOnLines({
  lines,
  config,
  includeInputTaxed = false,
}: {
  lines: GstLine[];
  config: GstConfig;
  includeInputTaxed?: boolean;
}): number {
  const rateMilli = config.rateMilli ?? 0;
  return lines.reduce((sum, line) => {
    const classification = classifyItem({
      category: line.category,
      overrides: line.overrides,
      config,
    });
    if (
      classification !== GstClassification.Taxable &&
      classification !== GstClassification.InputTaxed
    ) {
      return sum;
    }
    if (!includeInputTaxed && classification === GstClassification.InputTaxed) {
      return sum;
    }
    const gst = Math.round((line.amountCents * rateMilli) / 1000);
    return sum + gst;
  }, 0);
}
