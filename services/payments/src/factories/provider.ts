import { CbaBankingApiClient, CbaBankingProvider } from "../../../providers/banking/cba.js";
import { createBankingProvider } from "../../../providers/banking/index.js";
import type { BankingProvider } from "../../../providers/banking/types.js";

export type BankingProviderConfiguration = {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
};

export type ProviderFactoryOptions = {
  config: BankingProviderConfiguration;
  fetchImpl?: typeof fetch;
};

export function createConfiguredBankingProvider(
  options: ProviderFactoryOptions,
): BankingProvider {
  const providerId = options.config.providerId.toLowerCase();
  if (providerId === "cba") {
    const client = new CbaBankingApiClient({
      baseUrl: options.config.baseUrl,
      apiKey: options.config.apiKey,
      timeoutMs: options.config.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    return new CbaBankingProvider({ client });
  }

  return createBankingProvider(options.config.providerId);
}
