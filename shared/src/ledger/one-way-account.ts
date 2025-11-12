import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

export type TaxObligation = "PAYGW" | "GST";

const ALLOWED_TAX_TYPES: TaxObligation[] = ["PAYGW", "GST"];

function ensureTaxType(value: string): asserts value is TaxObligation {
  if (!ALLOWED_TAX_TYPES.includes(value as TaxObligation)) {
    throw new Error(`Unsupported tax type: ${value}`);
  }
}

export async function getOrCreateOneWayAccount(params: {
  orgId: string;
  taxType: string;
}) {
  ensureTaxType(params.taxType);
  const account = await prisma.oneWayAccount.upsert({
    where: {
      orgId_taxType: {
        orgId: params.orgId,
        taxType: params.taxType,
      },
    },
    create: {
      orgId: params.orgId,
      taxType: params.taxType,
    },
    update: {},
  });
  return account;
}

export async function depositToOneWayAccount(params: {
  orgId: string;
  taxType: string;
  amount: number | string | Prisma.Decimal;
}) {
  ensureTaxType(params.taxType);
  const amountDecimal = new Prisma.Decimal(params.amount);
  const account = await getOrCreateOneWayAccount(params);
  const updated = await prisma.oneWayAccount.update({
    where: { id: account.id },
    data: {
      balance: {
        increment: amountDecimal,
      },
      lastDepositAt: new Date(),
    },
  });
  return updated;
}

export async function fetchOneWayAccount(params: {
  orgId: string;
  taxType: string;
}) {
  ensureTaxType(params.taxType);
  return prisma.oneWayAccount.findUnique({
    where: {
      orgId_taxType: {
        orgId: params.orgId,
        taxType: params.taxType,
      },
    },
  });
}
