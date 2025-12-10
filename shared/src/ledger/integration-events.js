// shared/src/ledger/integration-events.ts
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db.js";
export async function recordIntegrationEvent(params) {
    const amountDecimal = new Decimal(params.amount);
    return prisma.integrationEvent.create({
        data: {
            orgId: params.orgId,
            taxType: params.taxType,
            source: params.source,
            amount: amountDecimal,
            // Avoid null for JSON column
            metadata: params.metadata
                ? params.metadata
                : undefined,
            status: params.status ?? "pending",
        },
    });
}
export async function markIntegrationEventProcessed(eventId) {
    return prisma.integrationEvent.update({
        where: { id: eventId },
        data: { status: "processed" },
    });
}
//# sourceMappingURL=integration-events.js.map