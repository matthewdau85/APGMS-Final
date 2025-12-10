import { BaseBankingProvider } from "./base.js";
const CAPABILITIES = {
    maxReadTransactions: 1000,
    maxWriteCents: 5_000_000,
};
export class NabBankingProvider extends BaseBankingProvider {
    constructor() {
        super("nab", CAPABILITIES);
    }
}
//# sourceMappingURL=nab.js.map