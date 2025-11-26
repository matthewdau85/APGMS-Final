import type { JurisdictionCode } from "../tax-types.js";
export declare enum TaxType {
    PAYGW = "PAYGW",
    GST = "GST",
    PAYGI = "PAYGI",
    FBT = "FBT",
    COMPANY_TAX = "COMPANY_TAX",
    OTHER = "OTHER"
}
export type PayPeriod = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
export interface TaxParameterSetMeta {
    id: string;
    jurisdiction: JurisdictionCode;
    taxType: TaxType;
    financialYear: string;
    validFrom: Date;
    validTo: Date | null;
    description?: string | null;
    source: "ATO" | "MANUAL" | "TEST" | "OTHER";
}
export interface PaygwBracket {
    /**
     * Apply this bracket if weekly income is < weeklyLessThan.
     * Use null for the top bracket (no upper bound).
     */
    weeklyLessThan: number | null;
    /**
     * Coefficient "a" in ATO formulas.
     */
    a: number | null;
    /**
     * Coefficient "b" in ATO formulas.
     */
    b: number | null;
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
    getPaygwConfigForSchedule?(jurisdiction: JurisdictionCode, payPeriod: PayPeriod, onDate: Date): Promise<PaygwConfig | null>;
    /**
     * Optional convenience for GST lookups.
     */
    getGstConfig?(jurisdiction: JurisdictionCode, onDate: Date): Promise<GstConfig | null>;
}
