import type { PrismaClient } from "@prisma/client";
import { seedAuTaxParameterSets } from "./tax-parameter-sets.seed.js";
import { seedPaygwWithholdingTable } from "./paygw-withholding.seed.js";
import { seedGstRules } from "./gst-rules.seed.js";

export async function seedAu(prisma: PrismaClient): Promise<void> {
  const { paygwSetId, gstSetId } = await seedAuTaxParameterSets(prisma);

  await seedPaygwWithholdingTable(prisma, paygwSetId);
  await seedGstRules(prisma, gstSetId);
}
