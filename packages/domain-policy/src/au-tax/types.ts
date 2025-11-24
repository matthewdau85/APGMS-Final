// packages/domain-policy/src/au-tax/types.ts

export type JurisdictionCode = "AU";

export enum TaxType {
  PAYGW = "PAYGW",
  GST = "GST",
  PAYGI = "PAYGI",
  FBT = "FBT",
  COMPANY_TAX = "COMPANY_TAX",
  OTHER = "OTHER",
}

export interface TaxParameterSetMeta {
  id: string;
  jurisdiction: JurisdictionCode;
  taxType: TaxType;
  // Australian financial year, e.g. "2024-2025"
  financialYear: string;
  validFrom: Date;
  validTo: Date | null;
  description?: string;
  versionTag?: string;
}

export interface PaygwBracket {
  // Threshold at and above which this bracket applies, in whole cents.
  thresholdCents: number;
  // Base withholding amount for this bracket, in whole cents (ATO style).
  baseWithholdingCents: number;
  // Marginal rate above the threshold, expressed in milli-rate (e.g. 325 = 32.5%).
  marginalRateMilli: number;
}

export interface PaygwConfig {
  meta: TaxParameterSetMeta;
  brackets: ReadonlyArray<PaygwBracket>;
  // Optional additional AU flags, e.g. Medicare levy switches, STSL flags, etc.
  flags?: Record<string, boolean | string | number>;
}

export interface GstConfig {
  meta: TaxParameterSetMeta;
  // Rate in basis points, e.g. 1000 = 10.00%
  gstRateBps: number;
  // Future extension: reduced rates, exemptions, etc.
  flags?: Record<string, boolean | string | number>;
}

/**
 * Union view over AU tax config.
 * Engines should downcast based on taxType.
 */
export type AuTaxConfig = PaygwConfig | GstConfig;

/**
 * Repository interface used by engines to load AU tax configuration.
 */
export interface TaxConfigRepository {
  /**
   * Resolve the AU tax parameter set in effect for the given date and tax type.
   * Must enforce non-overlapping validity windows at the storage layer.
   */
  getActiveConfig(params: {
    jurisdiction: JurisdictionCode;
    taxType: TaxType;
    onDate: Date;
  }): Promise<AuTaxConfig>;
}
