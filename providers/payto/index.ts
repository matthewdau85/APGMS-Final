import { AnzPayToProvider } from "./anz.js";
import { NabPayToProvider } from "./nab.js";
import { MockPayToProvider } from "./mock.js";
import type {
  PayToProvider,
  PayToProviderDependencies,
  PayToProviderOptions,
} from "./types.js";

export * from "./types.js";

export function createPayToProvider(
  options: PayToProviderOptions,
  deps?: PayToProviderDependencies,
): PayToProvider {
  const normalized = options.id.toLowerCase();
  switch (normalized) {
    case "nab":
      return new NabPayToProvider(options, deps);
    case "anz":
      return new AnzPayToProvider(options, deps);
    case "mock":
    default:
      return new MockPayToProvider();
  }
}
