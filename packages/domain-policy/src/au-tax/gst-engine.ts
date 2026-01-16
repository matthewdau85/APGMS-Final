// packages/domain-policy/src/au-tax/gst-engine.ts
//
// AU GST calculation engine (simplified).
//
// What this does:
// - Loads the active GST config (rate + category classification map).
// - Computes GST on sales lines (1A) and input tax credits on purchase lines (1B),
//   using the same category->classification mapping.
// - Applies adjustments as GST-bearing deltas (positive or negative amounts).
//
// What this does NOT do (ATO-grade gaps):
// - Does not determine whether acquisitions are creditable.
// - Does not model adjustments by BAS label, attribution rules, or timing rules.
// - Does not model exports timing rules (e.g. 60-day export requirement).
// - Does not model mixed supplies, margin scheme, etc.

import { TaxType, type GstConfig, type TaxConfigRepository } from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";
import { type GstLine, computeGstOnLines } from "./gst-utils.js";

export interface GstCalculationInput {
  orgId: string;
  jurisdiction: JurisdictionCode;
  asOf: Date;

  salesLines?: GstLine[];
  purchaseLines?: GstLine[];
  adjustments?: GstLine[];
}

export interface GstCalculationResult {
  orgId: string;
  jurisdiction: JurisdictionCode;
  asOf: Date;

  gstOnSalesCents: number;
  gstOnPurchasesCents: number;
  gstOnAdjustmentsCents: number;

  netGstCents: number;
  isRefundDue: boolean;

  // Backward-compatible naming if other modules already use this property.
  // This value is expressed in cents.
  carryForwardAmount: number;

  configUsed: GstConfig;
}

export class GstEngine {
  constructor(private readonly repo: TaxConfigRepository) {}

  async calculate(input: GstCalculationInput): Promise<GstCalculationResult> {
    const { orgId, jurisdiction, asOf } = input;

    const anyRepo = this.repo as any;

    // Support either a dedicated getter or the generic config repository.
    const config: GstConfig | null =
      (typeof anyRepo.getGstConfig === "function"
        ? await anyRepo.getGstConfig(jurisdiction, asOf)
        : typeof anyRepo.getActiveConfig === "function"
          ? await anyRepo.getActiveConfig(jurisdiction, TaxType.GST, asOf)
          : null) ?? null;

    if (!config) {
      throw new Error(`TAX_CONFIG_MISSING: No ACTIVE GST config for ${jurisdiction}`);
    }

    const sales = input.salesLines ?? [];
    const purchases = input.purchaseLines ?? [];
    const adjustments = input.adjustments ?? [];

    const gstOnSalesCents = computeGstOnLines(sales, config) as number;

    // Purchases are treated as potential input tax credits. In an ATO-grade model,
    // you must also check creditable acquisition rules; here we only classify.
    const gstOnPurchasesCents = computeGstOnLines(purchases, config) as number;

    // Adjustments are applied as deltas (negative amounts reduce net GST).
    const gstOnAdjustmentsCents = computeGstOnLines(adjustments, config) as number;

    const netGstCents = gstOnSalesCents - gstOnPurchasesCents + gstOnAdjustmentsCents;
    const isRefundDue = netGstCents < 0;
    const carryForwardAmount = isRefundDue ? Math.abs(netGstCents) : 0;

    return {
      orgId,
      jurisdiction,
      asOf,
      gstOnSalesCents,
      gstOnPurchasesCents,
      gstOnAdjustmentsCents,
      netGstCents,
      isRefundDue,
      carryForwardAmount,
      configUsed: config,
    };
  }
}
