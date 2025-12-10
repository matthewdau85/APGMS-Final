import { BaseBankingProvider } from "./base.js";
const CAPABILITIES = {
    maxReadTransactions: 200,
    maxWriteCents: 1_000_000,
};
export class MockBankingProvider extends BaseBankingProvider {
    constructor() {
        super("mock", CAPABILITIES);
    }
}
//# sourceMappingURL=mock.js.map