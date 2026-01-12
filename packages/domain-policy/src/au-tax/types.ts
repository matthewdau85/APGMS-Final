// packages/domain-policy/src/au-tax/types.ts

export enum TaxType {
  PAYGW = "PAYGW",
  GST = "GST",
}

export type PayPeriod = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "ANNUAL";

export const GstClassification = {
  Taxable: "taxable",
  GstFree: "gst_free",
  InputTaxed: "input_taxed",
} as const;

export type GstClassificationType =
  (typeof GstClassification)[keyof typeof GstClassification];

export interface PaygwBracket {
  thresholdCents: number;
  baseCents: number;
  rate: number; // decimal, e.g. 0.325
}

export interface PaygwConfig {
  kind: "PAYGW";
  jurisdiction: string;
  taxType: TaxType.PAYGW;
  brackets: PaygwBracket[];
}

export interface GstConfig {
  kind: "GST";
  jurisdiction: string;
  taxType: TaxType.GST;
  rateMilli: number;
  classificationMap?: Record<string, GstClassificationType>;
  adjustmentsPolicy?: {
    netting: string;
    negativeNet: "refund_or_carry" | "carry_only";
  };
}

export type AuTaxConfig = PaygwConfig | GstConfig;

export interface AuTaxConfigProvider {
  getActiveParameterSetWithTables(input: {
    taxType: "PAYGW" | "GST";
    onDate: Date;
  }): Promise<any>;
}

export interface TaxConfigRepository {
  getActiveConfig(input: {
    jurisdiction: string;
    taxType: TaxType;
    onDate: Date;
  }): Promise<AuTaxConfig | null>;
}
