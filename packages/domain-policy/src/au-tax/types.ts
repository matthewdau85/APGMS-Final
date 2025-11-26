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

// Accept both legacy uppercase values and the lowercase strings used in tests
// so the engine can be fed either style without additional coercion at call
// sites.
export type PayPeriod =
  | "WEEKLY"
  | "FORTNIGHTLY"
  | "MONTHLY"
  | "weekly"
  | "fortnightly"
  | "monthly";

export interface TaxParameterSetMeta {
  id: string;
  jurisdiction: JurisdictionCode;
  taxType: TaxType;
  financialYear: string; // e.g. "2024-2025"
  validFrom: Date;
  validTo: Date | null;
  description?: string | null;
  source: "ATO" | "MANUAL" | "TEST" | "OTHER";
}

export interface PaygwBracket {
  /**
   * Lower bound (inclusive) for the bracket, expressed in cents for weekly
   * income. Brackets are evaluated in order and the highest matching
   * threshold will be used.
   */
  thresholdCents: number;
  /**
   * Fixed amount to withhold at the start of the bracket, in cents.
   */
  baseWithholdingCents: number;
  /**
   * Marginal rate applied to income above the threshold, expressed in milli-
   * rate (per thousand). For example, 100 = 10%.
   */
  marginalRateMilli: number;
}

export interface PaygwConfig {
  meta: TaxParameterSetMeta;
  jurisdiction: JurisdictionCode;
  taxType: TaxType.PAYGW;
  payPeriod: PayPeriod;
  brackets: PaygwBracket[];
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
