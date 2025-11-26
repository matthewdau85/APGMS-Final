// packages/domain-policy/src/au-tax/gst-engine.ts

import {
  TaxType,
  type GstConfig,
  type TaxConfigRepository,
} from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";

export interface GstCalculationInput {
  orgId: string;
  jurisdiction: JurisdictionCode;
  taxableSuppliesCents: number;
  gstFreeSuppliesCents: number;
  inputTaxCreditsCents: number;
  asOf: Date;
}

export interface GstCalculationResult {
  netPayableCents: number;
  configUsed?: GstConfig;
}

export class GstEngine {
  constructor(private readonly repo: TaxConfigRepository) {}

  async calculate(
    input: GstCalculationInput
  ): Promise<GstCalculationResult> {
    const { jurisdiction, asOf } = input;

    const config =
      (this.repo.getGstConfig
        ? await this.repo.getGstConfig(jurisdiction, asOf)
        : ((await this.repo.getActiveConfig({
            jurisdiction,
            taxType: TaxType.GST,
            onDate: asOf,
          })) as GstConfig | null));

    if (!config) {
      throw new Error("No GST config for jurisdiction/date");
    }

    const taxableBase =
      input.taxableSuppliesCents - input.gstFreeSuppliesCents;
    const gstOnSupplies = Math.round(
      (taxableBase * config.rateMilli) / 1000
    );
    const netPayableCents = gstOnSupplies - input.inputTaxCreditsCents;

    return { netPayableCents, configUsed: config };
  }
}
