import { BaseBankingProvider } from "./base.js";
import type { BankingProviderCapabilities } from "./types.js";

const CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 200,
  maxWriteCents: 1_000_000,
};

export class MockBankingProvider extends BaseBankingProvider {
  constructor() {
    super("mock", CAPABILITIES);
  }
}

