import type { PrismaClient } from "@prisma/client";

import type { ApplyDesignatedTransferResult } from "@apgms/domain-policy";

import type {
  BankingProvider,
  BankingProviderContext,
} from "../../../providers/banking/types.js";

export type CreditDesignatedAccountPayload = {
  orgId: string;
  actorId: string;
  accountId: string;
  amount: number;
  source: string;
};

export type PaymentsServiceDependencies = {
  provider: BankingProvider;
  prisma: PrismaClient;
  auditLogger?: BankingProviderContext["auditLogger"];
};

export type PaymentsService = {
  creditDesignatedAccount(
    input: CreditDesignatedAccountPayload,
  ): Promise<ApplyDesignatedTransferResult>;
};
