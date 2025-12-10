import type { PrismaClient } from "@prisma/client";
import type { DesignatedAccountType } from "./types.js";
export interface DesignatedAccount {
    id: string;
    orgId: string;
    type: string;
    balance: unknown;
    updatedAt: Date;
    locked: boolean;
}
export interface BankingAdapter {
    getBalance(account: DesignatedAccount): Promise<number>;
    blockTransfer?(account: DesignatedAccount, shortfall: number): Promise<void>;
}
/** Configure the adapter that simulates the banking partner. Swap this for a sandbox/ADI connector later. */
export declare function configureBankingAdapter(adapter: BankingAdapter): void;
export declare function getDesignatedAccountByType(prisma: PrismaClient, orgId: string, type: string): Promise<DesignatedAccount>;
export interface CoverageContext {
    cycleId?: string;
    description?: string;
}
export declare function ensureDesignatedAccountCoverage(prisma: PrismaClient, orgId: string, type: DesignatedAccountType, requiredAmount: number, context?: CoverageContext): Promise<DesignatedAccount>;
export declare function releaseAccountLock(prisma: PrismaClient, accountId: string): Promise<void>;
export declare function markAccountLocked(prisma: PrismaClient, accountId: string): Promise<void>;
export declare function reconcileAccountSnapshot(prisma: PrismaClient, orgId: string, type: DesignatedAccountType): Promise<{
    account: DesignatedAccount;
    balance: number;
    updatedAt: Date;
    locked: boolean;
}>;
//# sourceMappingURL=designated-account.d.ts.map