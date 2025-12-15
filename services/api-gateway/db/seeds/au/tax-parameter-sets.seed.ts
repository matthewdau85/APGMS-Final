import { AuTaxType, TaxConfigStatus, type PrismaClient } from "@prisma/client";

export async function seedAuTaxParameterSets(prisma: PrismaClient) {
  const retrievedAt = new Date();

  // NOTE: These are scaffold values. Step 2+ will make engines require ACTIVE sets,
  // and Step 5 worker will manage versioning/updates.
  const paygw = await prisma.auTaxParameterSet.upsert({
    where: {
      taxType_effectiveFrom: {
        taxType: AuTaxType.PAYGW,
        effectiveFrom: new Date("2025-07-01"),
      },
    },
    update: {
      status: TaxConfigStatus.ACTIVE,
      sourceName: "ATO",
      sourceRef: "seed:paygw:2025-07-01",
      sourceHash: "seed:paygw:2025-07-01",
      retrievedAt,
    },
    create: {
      taxType: AuTaxType.PAYGW,
      status: TaxConfigStatus.ACTIVE,
      effectiveFrom: new Date("2025-07-01"),
      effectiveTo: null,
      sourceName: "ATO",
      sourceRef: "seed:paygw:2025-07-01",
      sourceHash: "seed:paygw:2025-07-01",
      retrievedAt,
    },
  });

  const gst = await prisma.auTaxParameterSet.upsert({
    where: {
      taxType_effectiveFrom: {
        taxType: AuTaxType.GST,
        effectiveFrom: new Date("2000-07-01"),
      },
    },
    update: {
      status: TaxConfigStatus.ACTIVE,
      sourceName: "ATO",
      sourceRef: "seed:gst:2000-07-01",
      sourceHash: "seed:gst:2000-07-01",
      retrievedAt,
    },
    create: {
      taxType: AuTaxType.GST,
      status: TaxConfigStatus.ACTIVE,
      effectiveFrom: new Date("2000-07-01"),
      effectiveTo: null,
      sourceName: "ATO",
      sourceRef: "seed:gst:2000-07-01",
      sourceHash: "seed:gst:2000-07-01",
      retrievedAt,
    },
  });

  return { paygwSetId: paygw.id, gstSetId: gst.id };
}
