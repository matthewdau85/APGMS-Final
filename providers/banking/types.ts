import type { PrismaClient } from "@prisma/client";

import type {
  ApplyDesignatedTransferResult,
  ApplyDesignatedTransferInput,
} from "../../domain/policy/designated-accounts.js";

export type PartnerDesignatedCreditRequest = {
  orgId: string;
  accountId: string;
  amountCents: number;
  source: string;
  actorId: string;
  clientReference: string;
  metadata?: Record<string, unknown>;
};

export type PartnerDesignatedCreditResponse = {
  status: "ACCEPTED" | "SETTLED" | "PENDING" | "REJECTED";
  partnerReference: string;
  settledAmountCents?: number;
  raw?: unknown;
};

export interface PartnerBankingApi {
  creditDesignatedAccount(
    request: PartnerDesignatedCreditRequest,
  ): Promise<PartnerDesignatedCreditResponse>;
}

export type BankingProviderId = "nab" | "anz" | "mock";

export type BankingProviderCapabilities = {
  maxReadTransactions: number;
  maxWriteCents: number;
};

export type BankingProviderContext = {
  prisma: PrismaClient;
  orgId: string;
  actorId: string;
  auditLogger?: (entry: {
    orgId: string;
    actorId: string;
    action: string;
    metadata: Record<string, unknown>;
  }) => Promise<void>;
  partnerBankingApi?: PartnerBankingApi;
};

export type CreditDesignatedAccountInput = Omit<
  ApplyDesignatedTransferInput,
  "orgId" | "actorId"
>;

export interface BankingProvider {
  readonly id: BankingProviderId;
  readonly capabilities: BankingProviderCapabilities;

  creditDesignatedAccount(
    context: BankingProviderContext,
    input: CreditDesignatedAccountInput,
  ): Promise<ApplyDesignatedTransferResult>;

  simulateDebitAttempt(
    context: BankingProviderContext,
    input: CreditDesignatedAccountInput,
  ): Promise<never>;
}

