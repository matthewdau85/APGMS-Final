import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db.js";
const SEVERITY_THRESHOLD = {
    medium: 0.3,
    high: 0.6,
};
export function formatCurrency(value) {
    return Number(value.toString()).toFixed(2);
}
export async function analyzeIntegrationAnomaly(orgId, taxType) {
    const events = await prisma.integrationEvent.findMany({
        where: {
            orgId,
            taxType,
            status: { in: ["processed", "verified"] },
        },
        orderBy: { createdAt: "desc" },
        take: 24,
    });
    const amounts = events.map((event) => {
        const decimal = new Decimal(event.amount);
        return Number(decimal.toString());
    });
    const latestAmount = amounts[0] ?? 0;
    const mean = amounts.length > 0
        ? amounts.reduce((sum, value) => sum + value, 0) / amounts.length
        : 0;
    const ratio = mean > 0 ? (latestAmount - mean) / mean : 0;
    let severity = "low";
    if (ratio >= SEVERITY_THRESHOLD.high) {
        severity = "high";
    }
    else if (ratio >= SEVERITY_THRESHOLD.medium) {
        severity = "medium";
    }
    const explanation = Math.abs(ratio) <= 0.1
        ? "Recent deposits are within normal historical variation."
        : ratio > 0
            ? `Recent deposits exceed the historical average by ${Math.round(ratio * 100)}%.`
            : `Recent deposits fall below the historical average by ${Math.round(-ratio * 100)}%.`;
    const template = `
    Latest ${taxType} deposit: $${latestAmount.toFixed(2)}.
    Historical average: $${mean.toFixed(2)}.
    Severity: ${severity}.
    Advice: ${ratio >= SEVERITY_THRESHOLD.medium
        ? "Monitor upcoming BAS lodgments closely."
        : "Status normal."}
  `;
    return {
        severity,
        score: Math.min(Math.max(ratio, -1), 1),
        latestAmount,
        mean,
        explanation: explanation.trim(),
        narrative: template.trim().replace(/\s+/g, " "),
    };
}
//# sourceMappingURL=anomaly.js.map