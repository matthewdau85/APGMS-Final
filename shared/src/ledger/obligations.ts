import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

export type ObligationStatus = "pending" | "verified" | "settled";

export async function recordObligation(params: {
  orgId: string;
  taxType: string;
  eventId: string;
  amount: number | string | Prisma.Decimal;
  status?: ObligationStatus;
}) {
  const amountDecimal = new Prisma.Decimal(params.amount);
  return prisma.integrationObligation.create({
    data: {
      orgId: params.orgId,
      taxType: params.taxType,
      eventId: params.eventId,
      amount: amountDecimal,
      status: params.status ?? "pending",
    },
  });
}

export async function aggregateObligations(orgId: string, taxType: string) {
  const [result] = await prisma.$queryRaw<
    { total: Prisma.Decimal | null }[]
  >`
    SELECT SUM("amount") as total
    FROM "IntegrationObligation"
    WHERE "orgId" = ${orgId} AND "taxType" = ${taxType} AND "status" = 'pending'
  `;
  return result?.total ?? new Prisma.Decimal(0);
}
