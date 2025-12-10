import { type ApplyDesignatedTransferResult } from "@apgms/domain-policy";
import type { BankingProvider, BankingProviderCapabilities, BankingProviderContext, BankingProviderId, CreditDesignatedAccountInput } from "./types.js";
export declare abstract class BaseBankingProvider implements BankingProvider {
    readonly id: BankingProviderId;
    readonly capabilities: BankingProviderCapabilities;
    protected constructor(id: BankingProviderId, capabilities: BankingProviderCapabilities);
    creditDesignatedAccount(context: BankingProviderContext, input: CreditDesignatedAccountInput): Promise<ApplyDesignatedTransferResult>;
    simulateDebitAttempt(context: BankingProviderContext, input: CreditDesignatedAccountInput): Promise<never>;
}
//# sourceMappingURL=base.d.ts.map