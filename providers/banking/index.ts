import { AnzBankingProvider } from "./anz.js";
import { MockBankingProvider } from "./mock.js";
import { NabBankingProvider } from "./nab.js";
import type { BankingProvider, BankingProviderId } from "./types.js";

export * from "./types.js";

export function createBankingProvider(
  id: BankingProviderId | string,
): BankingProvider {
  const normalized = id.toLowerCase();
  switch (normalized) {
    case "nab":
      return new NabBankingProvider();
    case "anz":
      return new AnzBankingProvider();
    case "mock":
    default:
      return new MockBankingProvider();
  }
}

