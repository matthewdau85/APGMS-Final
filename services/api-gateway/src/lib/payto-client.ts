import type { PayToProvider } from "../../../providers/payto/index.js";
import { createPayToProvider } from "../../../providers/payto/index.js";
import { config } from "../config.js";

let cachedProvider: PayToProvider | null = null;

export function resolvePayToProvider(): PayToProvider {
  if (!cachedProvider) {
    cachedProvider = createPayToProvider({
      id: config.payto.providerId,
      baseUrl: config.payto.baseUrl,
      credentialSecret: config.payto.credentialSecret,
    });
  }
  return cachedProvider;
}

export function setPayToProvider(provider: PayToProvider | null): void {
  cachedProvider = provider;
}
