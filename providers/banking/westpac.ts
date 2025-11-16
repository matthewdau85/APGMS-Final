import { BaseBankingProvider } from "./base.js";
import type { BankingProviderCapabilities } from "./types.js";

const CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 1_500,
  maxWriteCents: 6_000_000,
};

export class WestpacBankingProvider extends BaseBankingProvider {
  constructor() {
    super("wbc", CAPABILITIES);
  }
}
