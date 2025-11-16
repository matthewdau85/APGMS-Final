import { safeLogAttributes } from "../../shared/src/logging.js";

import { BaseBankingProvider } from "./base.js";
import type {
  BankingProviderCapabilities,
  BankingProviderContext,
  CreditDesignatedAccountInput,
} from "./types.js";
import {
  CbaBankingApiClient,
  type CbaBankingApiClientOptions,
} from "./cba-client.js";

const CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 1_500,
  maxWriteCents: 10_000_000,
};

export type CbaBankingProviderOptions = {
  client: CbaBankingApiClient;
  capabilities?: BankingProviderCapabilities;
};

export class CbaBankingProvider extends BaseBankingProvider {
  private readonly client: CbaBankingApiClient;

  constructor(options: CbaBankingProviderOptions) {
    super("cba", options.capabilities ?? CAPABILITIES);
    this.client = options.client;
  }

  override async creditDesignatedAccount(
    context: BankingProviderContext,
    input: CreditDesignatedAccountInput,
  ) {
    this.validateCreditDesignatedAccountInput(input);

    console.info(
      "banking-provider:cba credit",
      safeLogAttributes({
        orgId: context.orgId,
        actorId: context.actorId,
        accountId: input.accountId,
        amount: input.amount,
      }),
    );

    await this.client.createCredit({
      orgId: context.orgId,
      actorId: context.actorId,
      accountId: input.accountId,
      amount: input.amount,
      reference: input.source,
    });

    return this.applyCreditDesignatedAccount(context, input);
  }
}

export { CbaBankingApiClient } from "./cba-client.js";
