export type BasPeriodId = string; // e.g. "2024-Q1", "2024-07"

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
