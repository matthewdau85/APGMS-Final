import { AnzBankingProvider } from "./anz.js";
import { MockBankingProvider } from "./mock.js";
import { NabBankingProvider } from "./nab.js";
import { NabClient, type NabClientConfig } from "./nab-client.js";
import type { BankingProvider, BankingProviderId } from "./types.js";

export * from "./types.js";

export type ProviderFactoryOptions = {
  nab?: {
    client?: NabClient;
    config?: NabClientConfig;
  };
};

function buildNabClient(options?: ProviderFactoryOptions["nab"]): NabClient {
  if (options?.client) {
    return options.client;
  }
  const config: NabClientConfig =
    options?.config ?? {
      baseUrl:
        process.env.NAB_API_BASE_URL?.trim() ??
        "https://sandbox.api.nab.com.au/payments",
      clientId: process.env.NAB_CLIENT_ID?.trim() ?? "apgms-dev",
      clientSecret: process.env.NAB_CLIENT_SECRET?.trim() ?? "dev-secret",
    };
  return new NabClient(config);
}

export function createBankingProvider(
  id: BankingProviderId | string,
  options: ProviderFactoryOptions = {},
): BankingProvider {
  const normalized = id.toLowerCase();
  switch (normalized) {
    case "nab":
      return new NabBankingProvider(buildNabClient(options.nab));
    case "anz":
      return new AnzBankingProvider();
    case "mock":
    default:
      return new MockBankingProvider();
  }
}

