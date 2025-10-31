import { BaseBankingProvider } from "./base.js";
import type { BankingProviderCapabilities } from "./types.js";

const CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 800,
  maxWriteCents: 4_000_000,
};

export class AnzBankingProvider extends BaseBankingProvider {
  constructor() {
    super("anz", CAPABILITIES);
  }
}

