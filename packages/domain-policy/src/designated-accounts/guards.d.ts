import { type DesignatedAccount } from "./types.js";
export declare class DesignatedAccountRuleError extends Error {
    constructor(message: string);
}
/**
 * Helper for checking if an account is currently usable for new deposits.
 */
export declare function isActiveForNewDesignations(account: DesignatedAccount): boolean;
/**
 * Helper to express AU-specific semantics for tax account types.
 */
export declare function assertDesignatedAccountTypeIsSupported(account: DesignatedAccount): void;
