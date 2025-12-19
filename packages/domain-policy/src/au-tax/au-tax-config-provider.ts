import { prisma } from "@apgms/shared/db";

import type { AuTaxConfigProvider } from "@apgms/domain-policy/au/tax-config/resolveTaxParams.js";
import type { AuTaxType } from "@apgms/domain-policy/au/tax-config/types.js";

export const auTaxConfigProvider: AuTaxConfigProvider = {
  async findActiveParameterSet({ taxType, asOf }) {
    const row = await prisma.auTaxParameterSet.findFirst({
      where: {
        taxType: taxType as any,
        status: "ACTIVE",
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      include: { tables: true },
      orderBy: { effectiveFrom: "desc" },
    });

    if (!row) return null;

    return {
      id: row.id,
      taxType: row.taxType as AuTaxType,
      status: row.status as any,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      sourceName: row.sourceName,
      sourceRef: row.sourceRef,
      sourceHash: row.sourceHash,
      retrievedAt: row.retrievedAt,
      tables: row.tables.map((t) => ({
        kind: t.kind as any,
        payload: t.payload,
        payloadHash: t.payloadHash,
        name: t.name,
      })),
    };
  },
};
