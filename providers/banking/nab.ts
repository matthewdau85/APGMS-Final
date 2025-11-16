import { BaseBankingProvider } from "./base.js";
import type { BankingProviderCapabilities } from "./types.js";
import type { NabClient } from "./nab-client.js";

const CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 1000,
  maxWriteCents: 5_000_000,
};

export class NabBankingProvider extends BaseBankingProvider {
  constructor(private readonly client: NabClient) {
    super("nab", CAPABILITIES);
  }

  override async creditDesignatedAccount(
    context: Parameters<BaseBankingProvider["creditDesignatedAccount"]>[0],
    input: Parameters<BaseBankingProvider["creditDesignatedAccount"]>[1],
  ) {
    await this.client.creditDesignatedAccount({
      orgId: context.orgId,
      accountId: input.accountId,
      amountCents: Math.round(input.amount),
      reference: input.source,
    });
    return super.creditDesignatedAccount(context, input);
  }
}

