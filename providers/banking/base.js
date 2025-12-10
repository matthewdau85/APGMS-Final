import { AppError, safeLogAttributes } from "@apgms/shared";
import { applyDesignatedAccountTransfer, } from "@apgms/domain-policy";
export class BaseBankingProvider {
    constructor(id, capabilities) {
        this.id = id;
        this.capabilities = capabilities;
    }
    async creditDesignatedAccount(context, input) {
        if (input.amount <= 0) {
            throw new AppError(400, "invalid_amount", "Amount must be a positive value for credit operations");
        }
        console.info("banking-provider: credit attempt", safeLogAttributes({
            providerId: this.id,
            amount: input.amount,
            maxWriteCents: this.capabilities.maxWriteCents,
        }));
        if (input.amount > this.capabilities.maxWriteCents) {
            throw new AppError(400, "banking_write_cap_exceeded", `Amount ${input.amount} exceeds ${this.id} capability of ${this.capabilities.maxWriteCents}`);
        }
        const warningThreshold = this.capabilities.maxWriteCents * 0.9;
        if (input.amount >= warningThreshold) {
            console.warn("banking-provider: credit approaching cap", safeLogAttributes({
                providerId: this.id,
                amount: input.amount,
                maxWriteCents: this.capabilities.maxWriteCents,
            }));
        }
        return applyDesignatedAccountTransfer({
            prisma: context.prisma,
            auditLogger: context.auditLogger,
        }, {
            orgId: context.orgId,
            accountId: input.accountId,
            amount: input.amount,
            source: input.source,
            actorId: context.actorId,
        });
    }
    async simulateDebitAttempt(context, input) {
        try {
            await applyDesignatedAccountTransfer({
                prisma: context.prisma,
                auditLogger: context.auditLogger,
            }, {
                orgId: context.orgId,
                accountId: input.accountId,
                amount: -Math.abs(input.amount),
                source: input.source,
                actorId: context.actorId,
            });
        }
        catch (error) {
            if (error instanceof AppError &&
                error.code === "designated_withdrawal_attempt") {
                throw error;
            }
            throw new AppError(409, "banking_debit_blocked", "Debit attempt blocked by provider policy");
        }
        throw new AppError(500, "debit_policy_error", "Debit attempt unexpectedly passed policy checks");
    }
}
//# sourceMappingURL=base.js.map