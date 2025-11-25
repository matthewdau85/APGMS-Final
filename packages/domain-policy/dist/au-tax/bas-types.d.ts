export type BasPeriodId = string;
export type BasFrequency = "monthly" | "quarterly" | "annual";
export interface BasPeriod {
    id: BasPeriodId;
    orgId: string;
    frequency: BasFrequency;
    startDate: Date;
    endDate: Date;
    lodgmentDueDate: Date;
}
export type TaxObligationType = "PAYGW" | "GST";
export interface TaxObligation {
    id: string;
    orgId: string;
    basPeriodId: BasPeriodId;
    type: TaxObligationType;
    amountCents: number;
}
