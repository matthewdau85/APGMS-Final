// packages/domain-policy/src/au-tax/prisma-repository.ts

import type { PrismaClient } from "@prisma/client";
import type {
  AuTaxConfig,
  JurisdictionCode,
  TaxConfigRepository,
  TaxType,
} from "./types";

/**
 * Temporary stub of TaxConfigRepository backed by Prisma.
 *
 * This is here so the domain-policy package compiles cleanly while
 * the actual Prisma schema for AU tax tables is being finalised.
 *
 * Once your Prisma models are settled (AuTaxParameterSet, AuTaxRateSchedule,
 * etc.), we can replace this with a real implementation that:
 *   - queries those tables
 *   - enforces non-overlapping effective windows
 *   - maps rows into PaygwConfig / GstConfig.
 */
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
    // eslint-disable-next-line no-console
    console.warn(
      "[PrismaTaxConfigRepository] getActiveConfig called, but this is currently a stub. " +
        "Wire this up to your real Prisma models before using in production.",
      {
        jurisdiction: params.jurisdiction,
        taxType: params.taxType,
        onDate: params.onDate.toISOString(),
      }
    );

    throw new Error(
      "PrismaTaxConfigRepository.getActiveConfig is not implemented for your Prisma schema yet."
    );
  }
}
