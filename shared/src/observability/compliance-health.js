import { prisma } from "../db.js";
import { analyzeIntegrationAnomaly } from "../analytics/anomaly.js";
import { aggregateObligations } from "../ledger/obligations.js";
export async function complianceSnapshot(orgId, taxType = "PAYGW") {
    const [openDiscrepancies, pendingPlans, obligations, anomaly] = await Promise.all([
        prisma.discrepancyAlert.count({
            where: { orgId, resolved: false, taxType },
        }),
        prisma.paymentPlanRequest.count({
            where: { orgId, status: { in: ["SUBMITTED", "APPROVED"] } },
        }),
        aggregateObligations(orgId, taxType),
        analyzeIntegrationAnomaly(orgId, taxType),
    ]);
    return {
        taxType,
        pendingObligations: obligations.toString(),
        unresolvedDiscrepancies: openDiscrepancies,
        activePaymentPlans: pendingPlans,
        anomaly,
    };
}
//# sourceMappingURL=compliance-health.js.map