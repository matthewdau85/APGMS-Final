import { AnzBankingProvider } from "./anz.js";
import { MockBankingProvider } from "./mock.js";
import { NabBankingProvider } from "./nab.js";
import type {
  BankingProvider,
  BankingProviderCapabilities,
  BankingProviderId,
  BankingProviderOverrides,
} from "./types.js";

export * from "./types.js";

export function createBankingProvider(
  id: BankingProviderId | string,
  overrides?: BankingProviderOverrides,
): BankingProvider {
  const normalized = id.toLowerCase();
  switch (normalized) {
    case "nab":
      return new NabBankingProvider(overrides);
    case "anz":
      return new AnzBankingProvider(overrides);
    case "mock":
    default:
      return new MockBankingProvider(overrides);
  }
}

type ConfiguredProviderOptions = {
  id?: BankingProviderId | string;
  capabilities?: Partial<BankingProviderCapabilities>;
};

export function createConfiguredBankingProvider(
  options: ConfiguredProviderOptions = {},
): BankingProvider {
  const providerId = options.id ?? "mock";
  const capabilities = options.capabilities ?? {};
  return createBankingProvider(providerId, capabilities);
}

