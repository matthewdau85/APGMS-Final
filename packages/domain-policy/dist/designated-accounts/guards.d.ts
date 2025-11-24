import { DesignatedAccount } from "./types";
export declare enum DesignatedAccountOperation {
    DEPOSIT = "DEPOSIT",
    WITHDRAWAL = "WITHDRAWAL",
    INTERNAL_TRANSFER = "INTERNAL_TRANSFER"
}
export interface DesignatedAccountMovement {
    account: DesignatedAccount;
    operation: DesignatedAccountOperation;
    amountCents: number;
    metadata?: Record<string, unknown>;
}
export declare class DesignatedAccountRuleError extends Error {
    constructor(message: string);
}
/**
 * Enforce that one-way designated accounts:
 *   - Only accept deposits (no withdrawals) at the application level.
 *   - Obey lifecycle semantics (ACTIVE vs SUNSETTING vs CLOSED).
 *
 * This guard should be invoked before any ledger postings or banking
 * provider calls are executed.
 */
export declare function assertDesignatedAccountMovementAllowed(movement: DesignatedAccountMovement): void;
/**
 * Helper for checking if an account is currently usable for new deposits.
 * SUNSETTING accounts may or may not be allowed depending on policy;
 * this function restricts to ACTIVE only for new designations.
 */
export declare function isActiveForNewDesignations(account: DesignatedAccount): boolean;
/**
 * Helper to express AU-specific semantics for tax account types.
 * For example, we may want additional checks around PAYGW vs GST later.
 */
export declare function assertDesignatedAccountTypeIsSupported(account: DesignatedAccount): void;
