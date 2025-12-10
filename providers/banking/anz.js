import { BaseBankingProvider } from "./base.js";
const CAPABILITIES = {
    maxReadTransactions: 800,
    maxWriteCents: 4_000_000,
};
export class AnzBankingProvider extends BaseBankingProvider {
    constructor() {
        super("anz", CAPABILITIES);
    }
}
//# sourceMappingURL=anz.js.map