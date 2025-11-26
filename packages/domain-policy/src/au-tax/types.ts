// packages/domain-policy/src/au-tax/types.ts

import type { JurisdictionCode } from "../tax-types.js";

export enum TaxType {
  PAYGW = "PAYGW",
  GST = "GST",
  PAYGI = "PAYGI",
  FBT = "FBT",
  COMPANY_TAX = "COMPANY_TAX",
  OTHER = "OTHER",
}

// Supported payment frequencies for withholding calculations.
export type PayPeriod = "weekly" | "fortnightly" | "monthly";

export interface TaxParameterSetMeta {
  id: string;
  jurisdiction: JurisdictionCode;
  taxType: TaxType;
  financialYear: string; // e.g. "2024-2025"
  validFrom: Date;
  validTo: Date | null;
  description?: string | null;
  source: "ATO" | "MANUAL" | "TEST" | "OTHER";
  versionTag?: string | null;
}

// PAYGW brackets use threshold + base + marginal rate (per thousand).
export interface PaygwBracket {
  /**
   * Gross income (in cents) at which this bracket starts being applied.
   */
  thresholdCents: number;
  /**
   * Base withholding (in cents) applied once the threshold is reached.
   */
  baseWithholdingCents: number;
  /**
   * Marginal rate expressed in milli-units (e.g. 100 = 10%).
   */
  marginalRateMilli: number;
}

export interface PaygwConfig {
  meta: TaxParameterSetMeta;
  brackets: PaygwBracket[];
  /** Optional hints or feature flags for the schedule. */
  flags?: Record<string, unknown>;
  /** Optional pay period identifier if the schedule is period-specific. */
  payPeriod?: PayPeriod;
}

export interface GstConfig {
  meta: TaxParameterSetMeta;
  jurisdiction: JurisdictionCode;
  taxType: TaxType.GST;
  /**
   * GST rate in "per thousand" units, e.g. 100 = 10.0%.
   */
  rateMilli: number;
}

export type AuTaxConfig = PaygwConfig | GstConfig;

export interface TaxConfigRepository {
  /**
   * Generic "get whatever is active" API – flexible but a bit low-level.
   */
  getActiveConfig(params: {
    jurisdiction: JurisdictionCode;
    taxType: TaxType;
    onDate: Date;
  }): Promise<AuTaxConfig | null>;

  /**
   * Optional convenience for PAYGW lookups by schedule/pay period.
   */
  getPaygwConfigForSchedule?(
    jurisdiction: JurisdictionCode,
    payPeriod: PayPeriod,
    onDate: Date
  ): Promise<PaygwConfig | null>;

  /**
   * Optional convenience for GST lookups.
   */
  getGstConfig?(
    jurisdiction: JurisdictionCode,
    onDate: Date
  ): Promise<GstConfig | null>;
}
