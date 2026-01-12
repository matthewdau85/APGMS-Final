// packages/domain-policy/src/au-tax/gst-engine.ts

import {
  TaxType,
  type GstConfig,
  type TaxConfigRepository,
} from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";
import {
  GstLine,
  computeGstOnLines,
  GstClassification,
} from "./gst-utils.js";

export interface GstCalculationInput {
  orgId: string;
  jurisdiction: JurisdictionCode;
  asOf: Date;
  salesLines?: GstLine[];
  purchaseLines?: GstLine[];
  adjustments?: GstLine[];
}

export interface GstCalculationResult {
  gstOnSalesCents: number;
  gstOnPurchasesCents: number;
  netGstCents: number;
  isRefundDue: boolean;
  carryForwardAmount: number;
  configUsed?: GstConfig;
}

export class GstEngine {
  constructor(private readonly repo: TaxConfigRepository) {}

  async calculate(
    input: GstCalculationInput
  ): Promise<GstCalculationResult> {
    const { jurisdiction, asOf } = input;

    const config =
      (this.repo as any).getGstConfig
        ? await (this.repo as any).getGstConfig(jurisdiction, asOf)
        : ((await this.repo.getActiveConfig({
            jurisdiction,
            taxType: TaxType.GST,
            onDate: asOf,
          })) as GstConfig | null);

    if (!config) {
      throw new Error("No GST config for jurisdiction/date");
    }

    const salesLines = input.salesLines ?? [];
    const purchaseLines = input.purchaseLines ?? [];
    const adjustmentLines = input.adjustments ?? [];

    const gstOnSales = computeGstOnLines({
      lines: salesLines,
      config,
      includeInputTaxed: false,
    });
    const gstOnPurchases = computeGstOnLines({
      lines: purchaseLines,
      config,
      includeInputTaxed: false,
    });
    const adjustmentImpact = computeGstOnLines({
      lines: adjustmentLines,
      config,
      includeInputTaxed: true,
    });

    const netGst = gstOnSales - gstOnPurchases + adjustmentImpact;
    const isRefundDue = netGst < 0;
    const carryForward = isRefundDue ? Math.abs(netGst) : 0;

    const result = {
      gstOnSalesCents: gstOnSales,
      gstOnPurchasesCents: gstOnPurchases,
      netGstCents: netGst,
      isRefundDue,
      carryForwardAmount: carryForward,
      configUsed: config,
    };
    return result;
  }
}
