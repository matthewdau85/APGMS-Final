import { BaseBankingProvider } from "./base.js";
import type { BankingProviderCapabilities } from "./types.js";

const CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 1_200,
  maxWriteCents: 5_000_000,
};

export class CbaBankingProvider extends BaseBankingProvider {
  constructor() {
    super("cba", CAPABILITIES);
  }
}
