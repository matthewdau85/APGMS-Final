import { BaseBankingProvider } from "./base.js";
import type {
  BankingProviderCapabilities,
  BankingProviderOverrides,
} from "./types.js";

const DEFAULT_CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 1000,
  maxWriteCents: 5_000_000,
};

export class NabBankingProvider extends BaseBankingProvider {
  constructor(overrides?: BankingProviderOverrides) {
    super("nab", {
      ...DEFAULT_CAPABILITIES,
      ...overrides,
    });
  }
}

