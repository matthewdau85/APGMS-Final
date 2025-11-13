import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

export type TransferStatus = "queued" | "sent" | "failed";

export async function createTransferInstruction(params: {
  orgId: string;
  taxType: string;
  basId: string;
  amount: number | string | Prisma.Decimal;
  destination: string;
}) {
  const amountDecimal = new Prisma.Decimal(params.amount);
  return prisma.transferInstruction.create({
    data: {
      orgId: params.orgId,
      taxType: params.taxType,
      basId: params.basId,
      amount: amountDecimal,
      destination: params.destination,
    },
  });
}

export async function markTransferStatus(id: string, status: TransferStatus) {
  return prisma.transferInstruction.update({
    where: { id },
    data: {
      status,
    },
  });
}
