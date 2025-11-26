import type { JurisdictionCode } from "../tax-types.js";
export declare enum TaxType {
    PAYGW = "PAYGW",
    GST = "GST",
    PAYGI = "PAYGI",
    FBT = "FBT",
    COMPANY_TAX = "COMPANY_TAX",
    OTHER = "OTHER"
}
export type PayPeriod = "weekly" | "fortnightly" | "monthly";
export interface TaxParameterSetMeta {
    id: string;
    jurisdiction: JurisdictionCode;
    taxType: TaxType;
    financialYear: string;
    validFrom: Date;
    validTo: Date | null;
    description?: string | null;
    versionTag?: string | null;
    source?: "ATO" | "MANUAL" | "TEST" | "OTHER";
}
export interface PaygwBracket {
    /** Starting threshold for this bracket, in cents for the configured pay period. */
    thresholdCents: number;
    /** Fixed withholding for the bracket before applying marginal rates. */
    baseWithholdingCents: number;
    /** Marginal rate in per-thousand units (e.g. 100 = 10%). */
    marginalRateMilli: number;
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
    getPaygwConfigForSchedule?(jurisdiction: JurisdictionCode, payPeriod: PayPeriod, onDate: Date): Promise<PaygwConfig | null>;
    /**
     * Optional convenience for GST lookups.
     */
    getGstConfig?(jurisdiction: JurisdictionCode, onDate: Date): Promise<GstConfig | null>;
}
