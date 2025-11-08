import { MockPosProvider } from "./mock.js";
import type { PosProvider, PosProviderId } from "./types.js";

export * from "./types.js";

export function createPosProvider(id: PosProviderId | string): PosProvider {
  const normalized = id.toString().toLowerCase();
  switch (normalized) {
    case "mock":
      return new MockPosProvider();
    default:
      return new MockPosProvider();
  }
}
