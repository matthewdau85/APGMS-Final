import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function hashJson(value: unknown): string {
  return sha256Hex(JSON.stringify(value));
}
function requireDelegate(prisma: PrismaClient, key: string): any {
  const delegate = (prisma as any)[key];
  if (!delegate) {
    const keys = Object.keys(prisma as any).filter((k) => /tax|au/i.test(k));
    throw new Error(
      `PrismaClient is missing ${key} delegate. Debug keys: ${JSON.stringify(keys)}`,
    );
  }
  return delegate;
}

export async function seedPaygwWithholdingTable(
  prisma: PrismaClient,
  parameterSetId: string,
): Promise<void> {
  const auTaxRateTable = requireDelegate(prisma, "auTaxRateTable");

  const payload = {
    kind: "PAYGW_WITHHOLDING",
    version: "scaffold-2025-07-01",
    notes: "Placeholder table – replace with ATO schedule / bracket tables",
    brackets: [],
  };

  await auTaxRateTable.upsert({
    where: {
      parameterSetId_kind: { parameterSetId, kind: "PAYGW_WITHHOLDING" },
    },
    update: {
      name: "AU PAYGW withholding (scaffold)",
      payload,
      payloadHash: hashJson(payload),
    },
    create: {
      parameterSetId,
      kind: "PAYGW_WITHHOLDING",
      name: "AU PAYGW withholding (scaffold)",
      payload,
      payloadHash: hashJson(payload),
    },
  });
}
