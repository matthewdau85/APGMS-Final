export type JurisdictionCode = "AU";
export declare enum TaxType {
    PAYGW = "PAYGW",
    GST = "GST",
    PAYGI = "PAYGI",
    FBT = "FBT",
    COMPANY_TAX = "COMPANY_TAX",
    OTHER = "OTHER"
}
export interface TaxParameterSetMeta {
    id: string;
    jurisdiction: JurisdictionCode;
    taxType: TaxType;
    financialYear: string;
    validFrom: Date;
    validTo: Date | null;
    description?: string;
    versionTag?: string;
}
export interface PaygwBracket {
    thresholdCents: number;
    baseWithholdingCents: number;
    marginalRateMilli: number;
}
export interface PaygwConfig {
    meta: TaxParameterSetMeta;
    brackets: PaygwBracket[];
    flags?: Record<string, boolean | string | number>;
}
export interface GstConfig {
    meta: TaxParameterSetMeta;
    gstRateBps: number;
    flags?: Record<string, boolean | string | number>;
}
/**
 * Union view over AU tax config.
 * Engines should downcast based on taxType.
 */
export type AuTaxConfig = PaygwConfig | GstConfig;
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
