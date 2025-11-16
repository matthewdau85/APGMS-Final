import { AppError } from "@apgms/shared";

import { AnzBankingProvider } from "./anz.js";
import { CbaBankingProvider, type CbaBankingProviderOptions } from "./cba.js";
import { MockBankingProvider } from "./mock.js";
import { NabBankingProvider } from "./nab.js";
import type { BankingProvider, BankingProviderId } from "./types.js";

export * from "./types.js";

export type BankingProviderFactoryOptions = {
  cba?: CbaBankingProviderOptions;
};

export function createBankingProvider(
  id: BankingProviderId | string,
  options?: BankingProviderFactoryOptions,
): BankingProvider {
  const normalized = id.toLowerCase();
  switch (normalized) {
    case "cba":
      if (!options?.cba) {
        throw new AppError(
          500,
          "banking_provider_configuration",
          "CBA provider requires API client configuration",
        );
      }
      return new CbaBankingProvider(options.cba);
    case "nab":
      return new NabBankingProvider();
    case "anz":
      return new AnzBankingProvider();
    case "mock":
    default:
      return new MockBankingProvider();
  }
}

