import type { PrismaClient } from "@prisma/client";
import type { AuTaxConfig, JurisdictionCode, TaxConfigRepository, TaxType } from "./types";
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
export declare class PrismaTaxConfigRepository implements TaxConfigRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    getActiveConfig(params: {
        jurisdiction: JurisdictionCode;
        taxType: TaxType;
        onDate: Date;
    }): Promise<AuTaxConfig>;
}
