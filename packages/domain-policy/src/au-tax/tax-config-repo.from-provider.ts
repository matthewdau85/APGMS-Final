import type { PrismaClient } from "@prisma/client";
import type { JurisdictionCode } from "../tax-types.js";
import { TaxType, type TaxConfigRepository } from "./types.js";
import { resolveAuTaxConfig } from "./resolve-au-tax-config.js";

/**
 * Build a TaxConfigRepository from Prisma.
 *
 * NOTE: This uses direct Prisma access to the AU tax config tables.
 */
export function createTaxConfigRepositoryFromProvider(
  prisma: PrismaClient,
): TaxConfigRepository {
  return {
    async getPaygwConfig(jurisdiction: JurisdictionCode, onDate: Date) {
      return resolveAuTaxConfig(prisma, {
        jurisdiction,
        taxType: TaxType.PAYGW,
        onDate,
      }) as any;
    },

    async getGstConfig(jurisdiction: JurisdictionCode, onDate: Date) {
      return resolveAuTaxConfig(prisma, {
        jurisdiction,
        taxType: TaxType.GST,
        onDate,
      }) as any;
    },
  } as any;
}