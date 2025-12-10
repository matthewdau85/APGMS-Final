import { AnzBankingProvider } from "./anz.js";
import { MockBankingProvider } from "./mock.js";
import { NabBankingProvider } from "./nab.js";
export * from "./types.js";
export function createBankingProvider(id) {
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
//# sourceMappingURL=index.js.map