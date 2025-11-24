// packages/domain-policy/src/designated-accounts/guards.ts
import { DesignatedAccountLifecycle, DesignatedAccountType, } from "./types";
export var DesignatedAccountOperation;
(function (DesignatedAccountOperation) {
    DesignatedAccountOperation["DEPOSIT"] = "DEPOSIT";
    DesignatedAccountOperation["WITHDRAWAL"] = "WITHDRAWAL";
    DesignatedAccountOperation["INTERNAL_TRANSFER"] = "INTERNAL_TRANSFER";
})(DesignatedAccountOperation || (DesignatedAccountOperation = {}));
export class DesignatedAccountRuleError extends Error {
    constructor(message) {
        super(message);
        this.name = "DesignatedAccountRuleError";
    }
}
/**
 * Enforce that one-way designated accounts:
 *   - Only accept deposits (no withdrawals) at the application level.
 *   - Obey lifecycle semantics (ACTIVE vs SUNSETTING vs CLOSED).
 *
 * This guard should be invoked before any ledger postings or banking
 * provider calls are executed.
 */
export function assertDesignatedAccountMovementAllowed(movement) {
    const { account, operation, amountCents } = movement;
    if (amountCents <= 0) {
        throw new DesignatedAccountRuleError("Designated account movement amount must be positive");
    }
    if (account.lifecycle === DesignatedAccountLifecycle.CLOSED ||
        account.lifecycle === DesignatedAccountLifecycle.PENDING_ACTIVATION) {
        throw new DesignatedAccountRuleError(`Movements are not permitted for designated account ${account.id} in lifecycle state ${account.lifecycle}`);
    }
    if (account.lifecycle === DesignatedAccountLifecycle.SUNSETTING &&
        operation !== DesignatedAccountOperation.DEPOSIT) {
        throw new DesignatedAccountRuleError(`Only deposits are permitted for SUNSETTING designated account ${account.id}`);
    }
    if (operation !== DesignatedAccountOperation.DEPOSIT) {
        throw new DesignatedAccountRuleError(`Operation ${operation} is not permitted on one-way designated account ${account.id}`);
    }
}
/**
 * Helper for checking if an account is currently usable for new deposits.
 * SUNSETTING accounts may or may not be allowed depending on policy;
 * this function restricts to ACTIVE only for new designations.
 */
export function isActiveForNewDesignations(account) {
    return account.lifecycle === DesignatedAccountLifecycle.ACTIVE;
}
/**
 * Helper to express AU-specific semantics for tax account types.
 * For example, we may want additional checks around PAYGW vs GST later.
 */
export function assertDesignatedAccountTypeIsSupported(account) {
    switch (account.type) {
        case DesignatedAccountType.PAYGW:
        case DesignatedAccountType.GST:
        case DesignatedAccountType.PAYGI:
        case DesignatedAccountType.FBT:
        case DesignatedAccountType.OTHER:
            return;
        default:
            throw new DesignatedAccountRuleError(`Unsupported designated account type: ${String(account.type)}`);
    }
}
