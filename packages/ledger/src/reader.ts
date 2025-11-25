import type { TaxObligationType, BasPeriodId } from "@apgms/domain-policy"; // adjust path

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
  sumObligationsForPeriod(
    input: SumObligationsForPeriodInput
  ): Promise<number>;

  getDesignatedAccountBalance(
    input: GetDesignatedBalanceInput
  ): Promise<number>;
}
