// packages/ledger/src/reader.ts
// Thin type-only view of the AU tax domain, consumed by the ledger.
// We duplicate the minimal shapes here so this package does not depend
// on @apgms/domain-policy at build time.

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
  sumObligationsForPeriod(
    input: SumObligationsForPeriodInput,
  ): Promise<number>;

  getDesignatedAccountBalance(
    input: GetDesignatedBalanceInput,
  ): Promise<number>;
}
