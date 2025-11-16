export type ApplyDesignatedTransferInput = {
  orgId: string;
  accountId: string;
  amount: number;
  source: string;
  actorId: string;
};

export type ApplyDesignatedTransferResult = {
  accountId: string;
  newBalance: number;
  transferId: string;
  source: string;
};

export async function applyDesignatedAccountTransfer(
  _context: unknown,
  input: ApplyDesignatedTransferInput,
): Promise<ApplyDesignatedTransferResult> {
  return {
    accountId: input.accountId,
    newBalance: input.amount,
    transferId: "stub-transfer",
    source: input.source,
  };
}
