import type { PrismaClient } from "@prisma/client";
import { TaxType, type AuTaxConfig, type PaygwConfig, type GstConfig, type PayPeriod, type TaxConfigRepository } from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";
/**
 * Minimal stub for a Prisma-backed tax config repository.
 *
 * This keeps the type surface stable while you design the actual
 * Prisma schema and queries.
 */
export declare class PrismaTaxConfigRepository implements TaxConfigRepository {
    private readonly prisma;
    constructor(prisma: PrismaClient);
    getActiveConfig(params: {
        jurisdiction: JurisdictionCode;
        taxType: TaxType;
        onDate: Date;
    }): Promise<AuTaxConfig | null>;
    getPaygwConfigForSchedule(jurisdiction: JurisdictionCode, payPeriod: PayPeriod, asOf: Date): Promise<PaygwConfig | null>;
    getGstConfig(jurisdiction: JurisdictionCode, asOf: Date): Promise<GstConfig | null>;
}
