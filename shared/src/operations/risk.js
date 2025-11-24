import { prisma } from "../db.js";
import { complianceSnapshot } from "../observability/compliance-health.js";
const RISK_THRESHOLD = {
    high: 0.5,
    medium: 0.2,
};
export async function detectRisk(orgId, taxType = "PAYGW") {
    const snapshot = await complianceSnapshot(orgId, taxType);
    const score = snapshot.anomaly.score;
    let severity = "low";
    if (score >= RISK_THRESHOLD.high || snapshot.unresolvedDiscrepancies > 3)
        severity = "high";
    else if (score >= RISK_THRESHOLD.medium || snapshot.activePaymentPlans > 1)
        severity = "medium";
    const description = severity === "high"
        ? "Repeated shortfalls or severe anomalies detected."
        : severity === "medium"
            ? "Moderate anomaly score or multiple payment plans outstanding."
            : "Normal variance observed.";
    const record = await prisma.riskEvent.create({
        data: {
            orgId,
            taxType,
            severity,
            score,
            description,
        },
    });
    return { record, snapshot };
}
export async function listRiskEvents(orgId) {
    return prisma.riskEvent.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
    });
}
