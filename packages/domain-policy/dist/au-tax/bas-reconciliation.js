export class BasReconciliationService {
    constructor(mappingRepo, ledgerReader) {
        this.mappingRepo = mappingRepo;
        this.ledgerReader = ledgerReader;
    }
    async reconcile(input) {
        const types = ["PAYGW", "GST"];
        const lines = [];
        for (const type of types) {
            const mapping = await this.mappingRepo.getForOrgAndType(input.orgId, type);
            if (!mapping)
                continue;
            const obligationCents = await this.ledgerReader.sumObligationsForPeriod({
                orgId: input.orgId,
                basPeriodId: input.basPeriodId,
                type,
            });
            const designatedBalanceCents = await this.ledgerReader.getDesignatedAccountBalance({
                accountId: mapping.designatedAccountId,
                basPeriodId: input.basPeriodId,
            });
            const diff = designatedBalanceCents - obligationCents;
            let status = "OK";
            if (diff < 0)
                status = "SHORTFALL";
            if (diff > 0)
                status = "SURPLUS";
            lines.push({
                type,
                obligationCents,
                designatedBalanceCents,
                status,
                shortfallOrSurplusCents: diff,
            });
        }
        const overallStatus = lines.some(l => l.status === "SHORTFALL") ? "SHORTFALL" :
            lines.some(l => l.status === "SURPLUS") ? "SURPLUS" :
                "OK";
        return {
            orgId: input.orgId,
            basPeriodId: input.basPeriodId,
            lines,
            overallStatus,
        };
    }
}
