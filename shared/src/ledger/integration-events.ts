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
  const metadata = params.metadata ? (params.metadata as InputJsonValue) : null;

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

export async function markIntegrationEventProcessed(eventId: string) {
  return prisma.integrationEvent.update({
    where: { id: eventId },
    data: { status: "processed" },
  });
}
