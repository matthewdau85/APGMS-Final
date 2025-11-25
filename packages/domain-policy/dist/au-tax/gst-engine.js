export class GstEngine {
    constructor(config) {
        this.config = config;
    }
    calculate(tx) {
        if (!tx.taxable) {
            return { txId: tx.txId, gstCents: 0 };
        }
        const gstCents = Math.floor((tx.grossCents * this.config.rateMilli) / 100000);
        return { txId: tx.txId, gstCents };
    }
}
