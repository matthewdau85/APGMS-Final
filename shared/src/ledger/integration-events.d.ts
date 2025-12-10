import { Decimal } from "@prisma/client/runtime/library";
import { TaxObligation } from "./one-way-account.js";
export type IntegrationEventStatus = "pending" | "processed" | "failed";
export declare function recordIntegrationEvent(params: {
    orgId: string;
    taxType: TaxObligation;
    source: string;
    amount: number | string | Decimal;
    metadata?: Record<string, unknown>;
    status?: IntegrationEventStatus;
}): Promise<any>;
export declare function markIntegrationEventProcessed(eventId: string): Promise<any>;
//# sourceMappingURL=integration-events.d.ts.map