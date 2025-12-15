import { AuTaxRateTableKind, type PrismaClient } from "@prisma/client";
import { hashJson } from "./hash-json.js";

export async function seedPaygwWithholdingTable(prisma: PrismaClient, parameterSetId: string) {
  // Scaffold payload. Replace with canonical ATO table payload later (Step 2+).
  const payload = {
    schemaVersion: 1,
    kind: "PAYGW_WITHHOLDING",
    notes: "Scaffold table. Replace with canonical ATO withholding schedules.",
    brackets: [],
  };

  const payloadHash = hashJson(payload);

  await prisma.auTaxRateTable.upsert({
    where: {
      parameterSetId_kind: {
        parameterSetId,
        kind: AuTaxRateTableKind.PAYGW_WITHHOLDING,
      },
    },
    update: {
      name: "PAYGW withholding (scaffold)",
      payload,
      payloadHash,
    },
    create: {
      parameterSetId,
      kind: AuTaxRateTableKind.PAYGW_WITHHOLDING,
      name: "PAYGW withholding (scaffold)",
      payload,
      payloadHash,
    },
  });
}
