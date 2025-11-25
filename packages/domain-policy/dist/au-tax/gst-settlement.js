import { assertDesignatedAccountMovementAllowed } from "../designated-accounts/guards";
export class GstSettlementService {
    constructor(engine, mappingRepo, journalWriter) {
        this.engine = engine;
        this.mappingRepo = mappingRepo;
        this.journalWriter = journalWriter;
    }
    async settleBatch(batch) {
        const mapping = await this.mappingRepo.getForOrgAndType(batch.orgId, "GST");
        if (!mapping) {
            throw new Error(`No GST designated account mapping for org ${batch.orgId}`);
        }
        let totalGstCents = 0;
        for (const tx of batch.transactions) {
            const { gstCents } = this.engine.calculate(tx);
            totalGstCents += gstCents;
        }
        await assertDesignatedAccountMovementAllowed({
            accountId: mapping.designatedAccountId,
            movementType: "DEPOSIT",
            amountCents: totalGstCents,
        });
        const journalId = await this.journalWriter.writeJournal({
            orgId: batch.orgId,
            basPeriodId: batch.transactions[0]?.basPeriodId,
            entries: [
                {
                    accountId: mapping.designatedAccountId,
                    type: "CREDIT",
                    amountCents: totalGstCents,
                },
                {
                    accountId: "MAIN_OPERATING", // TODO real account
                    type: "DEBIT",
                    amountCents: totalGstCents,
                },
            ],
            meta: {
                kind: "GST_SETTLEMENT",
                txCount: batch.transactions.length,
            },
        });
        return { totalGstCents, journalId };
    }
}
