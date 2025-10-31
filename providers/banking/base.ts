import { AppError } from "@apgms/shared";

import {
  applyDesignatedAccountTransfer,
  type ApplyDesignatedTransferResult,
} from "../../domain/policy/designated-accounts.js";
import type {
  BankingProvider,
  BankingProviderCapabilities,
  BankingProviderContext,
  BankingProviderId,
  CreditDesignatedAccountInput,
} from "./types.js";

export abstract class BaseBankingProvider implements BankingProvider {
  readonly id: BankingProviderId;
  readonly capabilities: BankingProviderCapabilities;

  protected constructor(
    id: BankingProviderId,
    capabilities: BankingProviderCapabilities,
  ) {
    this.id = id;
    this.capabilities = capabilities;
  }

  async creditDesignatedAccount(
    context: BankingProviderContext,
    input: CreditDesignatedAccountInput,
  ): Promise<ApplyDesignatedTransferResult> {
    if (input.amount <= 0) {
      throw new AppError(
        400,
        "invalid_amount",
        "Amount must be a positive value for credit operations",
      );
    }

    return applyDesignatedAccountTransfer(
      {
        prisma: context.prisma,
        auditLogger: context.auditLogger,
      },
      {
        orgId: context.orgId,
        accountId: input.accountId,
        amount: input.amount,
        source: input.source,
        actorId: context.actorId,
      },
    );
  }

  async simulateDebitAttempt(
    context: BankingProviderContext,
    input: CreditDesignatedAccountInput,
  ): Promise<never> {
    try {
      await applyDesignatedAccountTransfer(
        {
          prisma: context.prisma,
          auditLogger: context.auditLogger,
        },
        {
          orgId: context.orgId,
          accountId: input.accountId,
          amount: -Math.abs(input.amount),
          source: input.source,
          actorId: context.actorId,
        },
      );
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "designated_withdrawal_attempt"
      ) {
        throw error;
      }

      throw new AppError(
        409,
        "banking_debit_blocked",
        "Debit attempt blocked by provider policy",
      );
    }

    throw new AppError(
      500,
      "debit_policy_error",
      "Debit attempt unexpectedly passed policy checks",
    );
  }
}

