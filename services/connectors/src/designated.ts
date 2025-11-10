import type {
  CreditDesignatedAccountInput as DomainCreditInput,
} from "../../../domain/policy/designated-accounts.js";
import { creditDesignatedAccountForObligation } from "../../../domain/policy/designated-accounts.js";

import type { DesignatedAccountCreditor, DesignatedAccountCreditInput } from "./types.js";

export function createPolicyDesignatedAccountCreditor(
  context: Parameters<typeof creditDesignatedAccountForObligation>[0],
): DesignatedAccountCreditor<Awaited<ReturnType<typeof creditDesignatedAccountForObligation>>> {
  return (input: DesignatedAccountCreditInput) => {
    const domainInput: DomainCreditInput = {
      orgId: input.orgId,
      accountType: input.accountType,
      amount: input.amount,
      source: input.source,
      actorId: input.actorId,
    };
    return creditDesignatedAccountForObligation(context, domainInput);
  };
}
