import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

export async function recordDiscrepancy(params: {
  orgId: string;
  taxType: string;
  eventId: string;
  expectedAmount: number | string | Prisma.Decimal;
  actualAmount: number | string | Prisma.Decimal;
  reason: string;
}) {
  const expected = new Prisma.Decimal(params.expectedAmount);
  const actual = new Prisma.Decimal(params.actualAmount);
  return prisma.discrepancyAlert.create({
    data: {
      orgId: params.orgId,
      taxType: params.taxType,
      eventId: params.eventId,
      expectedAmount: expected,
      actualAmount: actual,
      reason: params.reason,
    },
  });
}

export async function fetchRecentDiscrepancies(orgId: string) {
  return prisma.discrepancyAlert.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
