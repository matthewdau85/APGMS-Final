export type BasPeriodId = string;
export type TaxObligationType = string;
export interface SumObligationsForPeriodInput {
    orgId: string;
    basPeriodId: BasPeriodId;
    type: TaxObligationType;
}
export interface GetDesignatedBalanceInput {
    accountId: string;
    basPeriodId: BasPeriodId;
}
export interface LedgerReader {
    sumObligationsForPeriod(input: SumObligationsForPeriodInput): Promise<number>;
    getDesignatedAccountBalance(input: GetDesignatedBalanceInput): Promise<number>;
}
//# sourceMappingURL=reader.d.ts.map