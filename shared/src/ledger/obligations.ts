import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";
import { fetchOneWayAccount } from "./one-way-account.js";

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

export async function markObligationsStatus(orgId: string, taxType: string, status: ObligationStatus) {
  return prisma.integrationObligation.updateMany({
    where: { orgId, taxType, status: "pending" },
    data: { status },
  });
}

export async function verifyObligations(orgId: string, taxType: string) {
  const pending = await aggregateObligations(orgId, taxType);
  const account = await fetchOneWayAccount({ orgId, taxType });
  const balance = account?.balance ?? new Prisma.Decimal(0);
  let shortfall: Prisma.Decimal | null = null;
  if (balance.greaterThanOrEqualTo(pending)) {
    await markObligationsStatus(orgId, taxType, "verified");
  } else {
    shortfall = pending.minus(balance);
  }
  return { pending, balance, shortfall };
}
