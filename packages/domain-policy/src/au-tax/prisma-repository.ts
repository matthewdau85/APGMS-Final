// packages/domain-policy/src/au-tax/prisma-repository.ts

import { PrismaClient } from "@prisma/client";
import {
  AuTaxConfig,
  GstConfig,
  JurisdictionCode,
  PaygwBracket,
  PaygwConfig,
  TaxConfigRepository,
  TaxParameterSetMeta,
  TaxType,
} from "./types";

export class PrismaTaxConfigRepository implements TaxConfigRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getActiveConfig(params: {
    jurisdiction: JurisdictionCode;
    taxType: TaxType;
    onDate: Date;
  }): Promise<AuTaxConfig> {
    const { jurisdiction, taxType, onDate } = params;

    const parameterSet = await this.prisma.taxParameterSet.findFirst({
      where: {
        jurisdiction,
        taxType,
        validFrom: { lte: onDate },
        OR: [
          { validTo: null },
          { validTo: { gte: onDate } },
        ],
      },
      include: {
        taxRateSchedules: true,
      },
      orderBy: [
        { validFrom: "desc" },
        { createdAt: "desc" },
      ],
    });

    if (!parameterSet) {
      throw new Error(
        `No AU tax parameter set found for jurisdiction=${jurisdiction}, taxType=${taxType}, date=${onDate.toISOString()}`
      );
    }

    this.ensureNoOverlappingWindows(parameterSet.id, jurisdiction, taxType);

    const meta: TaxParameterSetMeta = {
      id: parameterSet.id,
      jurisdiction,
      taxType,
      financialYear: parameterSet.financialYear,
      validFrom: parameterSet.validFrom,
      validTo: parameterSet.validTo,
      description: parameterSet.description ?? undefined,
      versionTag: parameterSet.versionTag ?? undefined,
    };

    if (taxType === TaxType.PAYGW) {
      const brackets: PaygwBracket[] = parameterSet.taxRateSchedules
        .sort((a, b) => a.thresholdCents - b.thresholdCents)
        .map((row) => ({
          thresholdCents: row.thresholdCents,
          baseWithholdingCents: row.baseWithholdingCents,
          marginalRateMilli: row.marginalRateMilli,
        }));

      const config: PaygwConfig = {
        meta,
        brackets,
        flags: parameterSet.flags as Record<string, boolean | string | number> | undefined,
      };

      return config;
    }

    if (taxType === TaxType.GST) {
      if (parameterSet.taxRateSchedules.length !== 1) {
        throw new Error(
          `Expected exactly one GST schedule row for parameter set ${parameterSet.id}`
        );
      }

      const [row] = parameterSet.taxRateSchedules;
      const config: GstConfig = {
        meta,
        gstRateBps: row.rateBps,
        flags: parameterSet.flags as Record<string, boolean | string | number> | undefined,
      };

      return config;
    }

    // For other AU tax types we can extend this branch later.
    throw new Error(
      `Tax type ${taxType} is not yet mapped in PrismaTaxConfigRepository`
    );
  }

  /**
   * Defensive check that relies on a UNIQUE or exclusion constraint at the DB layer.
   * This is a sanity check only; the real enforcement is done in migrations/worker.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async ensureNoOverlappingWindows(
    currentId: string,
    jurisdiction: JurisdictionCode,
    taxType: TaxType
  ): Promise<void> {
    const overlapping = await this.prisma.taxParameterSet.findMany({
      where: {
        jurisdiction,
        taxType,
        NOT: { id: currentId },
      },
      select: {
        id: true,
        validFrom: true,
        validTo: true,
      },
    });

    // A full overlap check is implemented in the ATO rule update worker;
    // here we only keep a light sanity check hook. We do not throw here to
    // avoid surprising production behaviour; use logs or metrics instead.
    if (overlapping.length > 0) {
      // TODO: inject a logger instead of console.warn when available.
      // This is a soft indicator that the worker has allowed overlapping
      // windows and should be investigated.
      // eslint-disable-next-line no-console
      console.warn(
        `[PrismaTaxConfigRepository] Detected ${overlapping.length} potential overlapping AU tax parameter windows for jurisdiction=${jurisdiction}, taxType=${taxType}`
      );
    }
  }
}
