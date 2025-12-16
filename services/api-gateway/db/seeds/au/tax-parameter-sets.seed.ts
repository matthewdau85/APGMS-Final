import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * Seed scaffolding for AU Tax Parameter Sets.
 */
function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function requireDelegate(prisma: PrismaClient, key: string): any {
  const delegate = (prisma as any)[key];
  if (!delegate) {
    const keys = Object.keys(prisma as any).filter((k) => /tax|au/i.test(k));
    throw new Error(
      [
        `PrismaClient is missing ${key} delegate.`,
        `This usually means @prisma/client was generated from a schema that does NOT include the AU tax config models.`,
        ``,
        `Run (from services/api-gateway):`,
        `  pnpm db:generate`,
        ``,
        `Debug: prisma keys containing 'tax' or 'au': ${JSON.stringify(keys)}`,
      ].join("\n"),
    );
  }
  return delegate;
}

export async function seedAuTaxParameterSets(
  prisma: PrismaClient,
): Promise<{ paygwId: string; gstId: string }> {
  const auTaxParameterSet = requireDelegate(prisma, "auTaxParameterSet");

  const effectiveFrom = new Date("2025-07-01T00:00:00.000Z");

  const paygw = await auTaxParameterSet.upsert({
    where: {
      taxType_effectiveFrom: { taxType: "PAYGW", effectiveFrom },
    },
    update: {
      status: "ACTIVE",
      sourceName: "ATO (scaffold)",
      sourceRef: "seed:au:paygw:2025-07-01",
      sourceHash: sha256Hex("seed:au:paygw:2025-07-01"),
      retrievedAt: new Date(),
    },
    create: {
      taxType: "PAYGW",
      status: "ACTIVE",
      effectiveFrom,
      effectiveTo: null,
      sourceName: "ATO (scaffold)",
      sourceRef: "seed:au:paygw:2025-07-01",
      sourceHash: sha256Hex("seed:au:paygw:2025-07-01"),
      retrievedAt: new Date(),
    },
  });

  const gst = await auTaxParameterSet.upsert({
    where: {
      taxType_effectiveFrom: { taxType: "GST", effectiveFrom },
    },
    update: {
      status: "ACTIVE",
      sourceName: "ATO (scaffold)",
      sourceRef: "seed:au:gst:2025-07-01",
      sourceHash: sha256Hex("seed:au:gst:2025-07-01"),
      retrievedAt: new Date(),
    },
    create: {
      taxType: "GST",
      status: "ACTIVE",
      effectiveFrom,
      effectiveTo: null,
      sourceName: "ATO (scaffold)",
      sourceRef: "seed:au:gst:2025-07-01",
      sourceHash: sha256Hex("seed:au:gst:2025-07-01"),
      retrievedAt: new Date(),
    },
  });

  return { paygwId: paygw.id, gstId: gst.id };
}
