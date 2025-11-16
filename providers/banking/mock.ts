import { BaseBankingProvider } from "./base.js";
import type {
  BankingProviderCapabilities,
  BankingProviderOverrides,
} from "./types.js";

const DEFAULT_CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 200,
  maxWriteCents: 1_000_000,
};

export class MockBankingProvider extends BaseBankingProvider {
  constructor(overrides?: BankingProviderOverrides) {
    super("mock", {
      ...DEFAULT_CAPABILITIES,
      ...overrides,
    });
  }
}

