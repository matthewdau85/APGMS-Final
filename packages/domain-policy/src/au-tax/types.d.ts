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
    source: "ATO" | "MANUAL" | "TEST" | "OTHER";
    versionTag?: string | null;
}
export interface PaygwBracket {
    thresholdCents: number;
    baseWithholdingCents: number;
    marginalRateMilli: number;
}
export interface PaygwConfig {
    meta: TaxParameterSetMeta;
    brackets: PaygwBracket[];
    flags?: Record<string, unknown>;
    payPeriod?: PayPeriod;
}
export interface GstConfig {
    meta: TaxParameterSetMeta;
    jurisdiction: JurisdictionCode;
    taxType: TaxType.GST;
    rateMilli: number;
}
export type AuTaxConfig = PaygwConfig | GstConfig;
export interface TaxConfigRepository {
    getActiveConfig(params: {
        jurisdiction: JurisdictionCode;
        taxType: TaxType;
        onDate: Date;
    }): Promise<AuTaxConfig | null>;
    getPaygwConfigForSchedule?(jurisdiction: JurisdictionCode, payPeriod: PayPeriod, onDate: Date): Promise<PaygwConfig | null>;
    getGstConfig?(jurisdiction: JurisdictionCode, onDate: Date): Promise<GstConfig | null>;
}
