import { prisma } from "@apgms/shared/db.js";
import { TaxType, type AuTaxConfigProvider } from "./types.js";

/**
 * Prisma-backed AU tax config provider.
 *
 * IMPORTANT:
 * - For package subpaths, DO NOT include ".js" unless the package exports it.
 * - Implements getActiveParameterSetWithTables(), which resolveAuTaxConfig() expects.
 */
export const auTaxConfigProvider: AuTaxConfigProvider = {
  async getActiveParameterSetWithTables(args: {
    taxType: TaxType.PAYGW | TaxType.GST;
    onDate: Date;
  }) {
    const { taxType, onDate } = args;

    const row = await prisma.auTaxParameterSet.findFirst({
      where: {
        taxType: taxType as any,
        status: "ACTIVE",
        effectiveFrom: { lte: onDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }],
      },
      include: { tables: true },
      orderBy: { effectiveFrom: "desc" },
    });

    if (!row) return null;

    return {
      id: row.id,
      taxType: row.taxType as any,
      status: row.status as any,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      sourceName: row.sourceName,
      sourceRef: row.sourceRef,
      sourceHash: row.sourceHash,
      retrievedAt: row.retrievedAt,
      tables: row.tables.map((t: any) => ({
        kind: t.kind,
        payload: t.payload,
        payloadHash: t.payloadHash,
        name: t.name,
      })),
    };
  },
};
