import { BaseBankingProvider } from "./base.js";
import type { BankingProviderCapabilities } from "./types.js";

const CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 1000,
  maxWriteCents: 5_000_000,
};

export class NabBankingProvider extends BaseBankingProvider {
  constructor() {
    super("nab", CAPABILITIES);
  }
}

