import type { PrismaClient } from "@prisma/client";
import { TaxType, type TaxConfigRepository } from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";
import { resolveAuTaxConfig } from "./resolve-au-tax-config.js";

export function prismaTaxConfigRepository(
  prisma: PrismaClient
): TaxConfigRepository {
  return {
    async getActiveConfig({ jurisdiction, taxType, onDate }) {
      return resolveAuTaxConfig(prisma, {
        jurisdiction,
        taxType,
        onDate,
      });
    },

    async getGstConfig(jurisdiction: JurisdictionCode, onDate: Date) {
      return (await resolveAuTaxConfig(prisma, {
        jurisdiction,
        taxType: TaxType.GST,
        onDate,
      })) as any;
    },
  };
}
