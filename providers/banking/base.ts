import { randomUUID } from "node:crypto";

import { AppError } from "../../shared/src/errors.js";

import { evaluateDesignatedAccountPolicy } from "@apgms/shared/ledger";

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
  PartnerBankingApi,
  PartnerDesignatedCreditResponse,
} from "./types.js";

export abstract class BaseBankingProvider implements BankingProvider {
  readonly id: BankingProviderId;
  readonly capabilities: BankingProviderCapabilities;
  protected readonly partnerApi?: PartnerBankingApi;

  protected constructor(
    id: BankingProviderId,
    capabilities: BankingProviderCapabilities,
    partnerApi?: PartnerBankingApi,
  ) {
    this.id = id;
    this.capabilities = capabilities;
    this.partnerApi = partnerApi;
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

    const policy = evaluateDesignatedAccountPolicy({
      amount: input.amount,
      source: input.source,
    });

    if (!policy.allowed) {
      try {
        await applyDesignatedAccountTransfer(
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
      } catch (error) {
        throw error;
      }

      throw new AppError(
        500,
        "designated_policy_mismatch",
        "Designated account policy evaluation did not block transfer as expected",
      );
    }

    const partnerApi = context.partnerBankingApi ?? this.partnerApi;
    let partnerResponse: PartnerDesignatedCreditResponse | undefined;

    if (partnerApi) {
      const amountCents = Math.round(input.amount * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new AppError(
          400,
          "invalid_amount",
          "Amount must round to a positive number of cents",
        );
      }

      const clientReference = randomUUID();
      partnerResponse = await partnerApi.creditDesignatedAccount({
        orgId: context.orgId,
        accountId: input.accountId,
        amountCents,
        source: input.source,
        actorId: context.actorId,
        clientReference,
      });

      if (!partnerResponse) {
        throw new AppError(
          502,
          "banking_partner_unavailable",
          "Partner banking API returned no response",
        );
      }

      if (partnerResponse.status === "REJECTED") {
        throw new AppError(
          502,
          "banking_partner_rejected",
          "Partner banking API rejected the designated account credit",
        );
      }

      if (partnerResponse.status === "PENDING") {
        throw new AppError(
          503,
          "banking_partner_pending",
          "Partner banking API left the credit in a pending state",
        );
      }

      if (
        partnerResponse.settledAmountCents !== undefined &&
        partnerResponse.settledAmountCents !== amountCents
      ) {
        throw new AppError(
          409,
          "banking_partner_amount_mismatch",
          "Partner banking API settled an unexpected amount",
        );
      }
    }

    const result = await applyDesignatedAccountTransfer(
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

    if (partnerResponse && context.auditLogger) {
      await context.auditLogger({
        orgId: context.orgId,
        actorId: context.actorId,
        action: "designatedAccount.partnerReconcile",
        metadata: {
          accountId: result.accountId,
          amount: input.amount,
          partnerReference: partnerResponse.partnerReference,
          partnerStatus: partnerResponse.status,
        },
      });
    }

    return result;
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

