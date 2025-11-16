import { BaseBankingProvider } from "./base.js";
import type {
  BankingProviderCapabilities,
  BankingProviderOverrides,
} from "./types.js";

const DEFAULT_CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 800,
  maxWriteCents: 4_000_000,
};

export class AnzBankingProvider extends BaseBankingProvider {
  constructor(overrides?: BankingProviderOverrides) {
    super("anz", {
      ...DEFAULT_CAPABILITIES,
      ...overrides,
    });
  }
}

