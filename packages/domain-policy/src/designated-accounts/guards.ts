// packages/domain-policy/src/designated-accounts/guards.ts

import {
  DesignatedAccountType,
  DesignatedAccountLifecycle,
  type DesignatedAccount,
} from "./types.js";

export class DesignatedAccountRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignatedAccountRuleError";
  }
}

/**
 * Helper for checking if an account is currently usable for new deposits.
 */
export function isActiveForNewDesignations(
  account: DesignatedAccount
): boolean {
  return account.lifecycle === DesignatedAccountLifecycle.ACTIVE;
}

/**
 * Helper to express AU-specific semantics for tax account types.
 */
export function assertDesignatedAccountTypeIsSupported(
  account: DesignatedAccount
): void {
  switch (account.type) {
    case DesignatedAccountType.PAYGW:
    case DesignatedAccountType.GST:
    case DesignatedAccountType.PAYGI:
    case DesignatedAccountType.FBT:
    case DesignatedAccountType.OTHER:
      return;
    default:
      throw new DesignatedAccountRuleError(
        `Unsupported designated account type: ${String(account.type)}`
      );
  }
}
