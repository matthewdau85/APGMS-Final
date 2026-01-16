// packages/domain-policy/src/au-tax/gst-utils.ts
//
// AU GST helpers.
//
// Notes on intent and limits:
// - This module computes GST on a list of lines using a category->classification map.
// - Only "taxable" lines contribute GST; "gst_free" and "input_taxed" contribute 0.
// - This is not a full GST determination engine (it does not model mixed supplies,
//   margin scheme, imports, financial acquisitions threshold, adjustments by label, etc.).

import type { GstConfig } from "./types.js";

export const GstClassification = {
  TAXABLE: "taxable",
  GST_FREE: "gst_free",
  INPUT_TAXED: "input_taxed",
} as const;

export type GstClassificationType =
  (typeof GstClassification)[keyof typeof GstClassification];

export interface GstLineOverrides {
  classification?: GstClassificationType;
}

export interface GstLine {
  category: string;
  amountCents: number;
  description?: string;
  overrides?: GstLineOverrides;
}

export interface GstComputationDetail {
  gstCents: number;
  taxableBaseCents: number;
  gstFreeBaseCents: number;
  inputTaxedBaseCents: number;
  unmappedCategories: string[];
}

function normalizeClassification(value: unknown): GstClassificationType | null {
  if (value === GstClassification.TAXABLE) return GstClassification.TAXABLE;
  if (value === GstClassification.GST_FREE) return GstClassification.GST_FREE;
  if (value === GstClassification.INPUT_TAXED) return GstClassification.INPUT_TAXED;
  return null;
}

function resolveClassification(line: GstLine, config: GstConfig): GstClassificationType {
  const override = normalizeClassification(line.overrides?.classification);
  if (override) return override;

  const rawMap = (config as any).classificationMap as Record<string, unknown> | undefined;
  const mapped = rawMap ? normalizeClassification(rawMap[line.category]) : null;
  if (mapped) return mapped;

  // Default to taxable if the category is unknown. In an ATO-grade implementation,
  // you should normally *reject* unmapped categories at the edge and force mapping.
  return GstClassification.TAXABLE;
}

function computeLineGstCents(amountCents: number, rateMilli: number): number {
  // rateMilli: 100 = 10% (0.1). We keep integer arithmetic and round to nearest cent.
  // Example: 999 cents at 10% => 99.9 => 100 cents.
  return Math.round((amountCents * rateMilli) / 1000);
}

export function computeGstOnLines(
  lines: ReadonlyArray<GstLine>,
  config: GstConfig,
  opts?: { detail?: boolean; includeInputTaxed?: boolean },
): number | GstComputationDetail {
  const rateMilli = Number((config as any).rateMilli ?? 100);

  let gstCents = 0;
  let taxableBaseCents = 0;
  let gstFreeBaseCents = 0;
  let inputTaxedBaseCents = 0;

  const unmapped = new Set<string>();
  const rawMap = (config as any).classificationMap as Record<string, unknown> | undefined;

  for (const line of lines ?? []) {
    const cls = resolveClassification(line, config);

    // Track unmapped categories for observability (even though we default to taxable).
    if (!line.overrides?.classification && rawMap && rawMap[line.category] == null) {
      unmapped.add(line.category);
    }

    if (cls === GstClassification.TAXABLE) {
      taxableBaseCents += line.amountCents;
      gstCents += computeLineGstCents(line.amountCents, rateMilli);
    } else if (cls === GstClassification.GST_FREE) {
      gstFreeBaseCents += line.amountCents;
    } else if (cls === GstClassification.INPUT_TAXED) {
      inputTaxedBaseCents += line.amountCents;
    }
  }

  if (!opts?.detail) return gstCents;

  return {
    gstCents,
    taxableBaseCents,
    gstFreeBaseCents,
    inputTaxedBaseCents,
    unmappedCategories: Array.from(unmapped).sort(),
  };
}
