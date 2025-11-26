// shared/src/ledger/integration-events.ts
import { Decimal, InputJsonValue } from "@prisma/client/runtime/library";

import { prisma } from "../db.js";
import { TaxObligation } from "./one-way-account.js";

export type IntegrationEventStatus = "pending" | "processed" | "failed";

export async function recordIntegrationEvent(params: {
  orgId: string;
  taxType: TaxObligation;
  source: string;
  amount: number | string | Decimal;
  metadata?: Record<string, unknown>;
  status?: IntegrationEventStatus;
}) {
  const amountDecimal = new Decimal(params.amount);

  return prisma.integrationEvent.create({
    data: {
      orgId: params.orgId,
      taxType: params.taxType,
      source: params.source,
      amount: amountDecimal,
      // Avoid null for JSON column
      metadata: params.metadata
        ? (params.metadata as InputJsonValue)
        : undefined,
      status: params.status ?? "pending",
    },
  });
}

export async function markIntegrationEventProcessed(eventId: string) {
  return prisma.integrationEvent.update({
    where: { id: eventId },
    data: { status: "processed" },
  });
}
