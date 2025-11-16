import type { ApplyDesignatedTransferResult } from "@apgms/domain-policy";

import type { BankingProviderContext, CreditDesignatedAccountInput } from "../../../providers/banking/types.js";
import type {
  CreditDesignatedAccountPayload,
  PaymentsServiceDependencies,
} from "../types.js";

const toProviderContext = (
  deps: PaymentsServiceDependencies,
  input: CreditDesignatedAccountPayload,
): BankingProviderContext => ({
  prisma: deps.prisma,
  actorId: input.actorId,
  orgId: input.orgId,
  auditLogger: deps.auditLogger,
});

const toProviderInput = (
  input: CreditDesignatedAccountPayload,
): CreditDesignatedAccountInput => ({
  accountId: input.accountId,
  amount: input.amount,
  source: input.source,
});

export function createDesignatedAccountCreditService(
  deps: PaymentsServiceDependencies,
): (input: CreditDesignatedAccountPayload) => Promise<ApplyDesignatedTransferResult> {
  return async (input) =>
    deps.provider.creditDesignatedAccount(
      toProviderContext(deps, input),
      toProviderInput(input),
    );
}
