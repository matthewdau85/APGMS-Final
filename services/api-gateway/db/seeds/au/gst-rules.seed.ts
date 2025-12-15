import { AuTaxRateTableKind, type PrismaClient } from "@prisma/client";
import { hashJson } from "./hash-json.js";

export async function seedGstRules(prisma: PrismaClient, parameterSetId: string) {
  // Scaffold payload: GST rate rule is stable at 10% historically.
  // Still: we keep it in config to enforce “no hard-coded rates” in engines.
  const payload = {
    schemaVersion: 1,
    kind: "GST_RULES",
    gstRate: 0.1,
    notes: "Scaffold rules. Expand to include taxable/GST-free/input-taxed classification rules.",
  };

  const payloadHash = hashJson(payload);

  await prisma.auTaxRateTable.upsert({
    where: {
      parameterSetId_kind: {
        parameterSetId,
        kind: AuTaxRateTableKind.GST_RULES,
      },
    },
    update: {
      name: "GST rules (scaffold)",
      payload,
      payloadHash,
    },
    create: {
      parameterSetId,
      kind: AuTaxRateTableKind.GST_RULES,
      name: "GST rules (scaffold)",
      payload,
      payloadHash,
    },
  });
}
