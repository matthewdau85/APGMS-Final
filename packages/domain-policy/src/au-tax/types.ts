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

export type PayPeriod =
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "WEEKLY"
  | "FORTNIGHTLY"
  | "MONTHLY";

export interface TaxParameterSetMeta {
  id: string;
  jurisdiction: JurisdictionCode;
  taxType: TaxType;
  financialYear: string; // e.g. "2024-2025"
  validFrom: Date;
  validTo: Date | null;
  description?: string | null;
  source?: "ATO" | "MANUAL" | "TEST" | "OTHER";
  versionTag?: string;
}

export interface PaygwBracket {
  /** Income threshold (in cents) at which this bracket starts. */
  thresholdCents: number;
  /** Base withholding (in cents) for this bracket. */
  baseWithholdingCents: number;
  /** Marginal rate in milli-units (e.g. 200 = 20%). */
  marginalRateMilli: number;
  flags?: Record<string, unknown>;
}

export interface PaygwConfig {
  meta: TaxParameterSetMeta;
  jurisdiction?: JurisdictionCode;
  taxType?: TaxType.PAYGW;
  payPeriod?: PayPeriod;
  brackets: PaygwBracket[];
  flags?: Record<string, unknown>;
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
  getActiveConfig(params: {
    jurisdiction: JurisdictionCode;
    taxType: TaxType;
    onDate: Date;
  }): Promise<AuTaxConfig | null>;

  getPaygwConfigForSchedule?(
    jurisdiction: JurisdictionCode,
    payPeriod: PayPeriod,
    onDate: Date
  ): Promise<PaygwConfig | null>;

  getGstConfig?(
    jurisdiction: JurisdictionCode,
    onDate: Date
  ): Promise<GstConfig | null>;
}

export interface PaygwCalculationInput {
  jurisdiction?: JurisdictionCode;
  payPeriod?: PayPeriod | string;
  grossCents?: number;
  grossIncomeCents?: number;
  paymentDate?: Date;
  onDate?: Date;
  flags?: Record<string, unknown>;
}

export interface PaygwResult {
  amountCents: number;
  weeklyWithholdingCents: number;
  period: string;
  meta?: Record<string, unknown>;
  withholdingCents: number;
  parameterSetId?: string;
  bracketIndex: number;
  configUsed?: PaygwConfig | null;
}

export type AuTaxConfigRepo = Pick<
  TaxConfigRepository,
  "getActiveConfig" | "getPaygwConfigForSchedule"
>;
