import { MockStpProvider } from "./mock.js";
import type { StpProvider, StpProviderId } from "./types.js";

export * from "./types.js";

export function createStpProvider(id: StpProviderId | string): StpProvider {
  const normalized = id.toString().toLowerCase();
  switch (normalized) {
    case "mock":
      return new MockStpProvider();
    default:
      return new MockStpProvider();
  }
}
