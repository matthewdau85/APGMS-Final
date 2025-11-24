import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db.js";
export async function recordIntegrationEvent(params) {
    const amountDecimal = new Decimal(params.amount);
    const metadata = params.metadata ? params.metadata : null;
    const event = await prisma.integrationEvent.create({
        data: {
            orgId: params.orgId,
            taxType: params.taxType,
            source: params.source,
            amount: amountDecimal,
            metadata,
            status: params.status ?? "pending",
        },
    });
    return event;
}
export async function markIntegrationEventProcessed(eventId) {
    return prisma.integrationEvent.update({
        where: { id: eventId },
        data: { status: "processed" },
    });
}
