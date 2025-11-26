// packages/domain-policy/src/au-tax/prisma-repository.ts

import type { PrismaClient } from "@prisma/client";
import {
  TaxType,
  type AuTaxConfig,
  type PaygwConfig,
  type GstConfig,
  type PayPeriod,
  type TaxConfigRepository,
} from "./types.js";
import type { JurisdictionCode } from "../tax-types.js";

/**
 * Minimal stub for a Prisma-backed tax config repository.
 *
 * This keeps the type surface stable while you design the actual
 * Prisma schema and queries.
 */
export class PrismaTaxConfigRepository implements TaxConfigRepository {
  constructor(private readonly prisma: PrismaClient) {
    void prisma;
  }

  async getActiveConfig(params: {
    jurisdiction: JurisdictionCode;
    taxType: TaxType;
    onDate: Date;
  }): Promise<AuTaxConfig | null> {
    // TODO: Implement real Prisma queries using AuTaxParameterSet, etc.
    void params;
    return null;
  }

  async getPaygwConfigForSchedule(
    jurisdiction: JurisdictionCode,
    payPeriod: PayPeriod,
    asOf: Date
  ): Promise<PaygwConfig | null> {
    const cfg = await this.getActiveConfig({
      jurisdiction,
      taxType: TaxType.PAYGW,
      onDate: asOf,
    });
    return (cfg as PaygwConfig) ?? null;
  }

  async getGstConfig(
    jurisdiction: JurisdictionCode,
    asOf: Date
  ): Promise<GstConfig | null> {
    const cfg = await this.getActiveConfig({
      jurisdiction,
      taxType: TaxType.GST,
      onDate: asOf,
    });
    return (cfg as GstConfig) ?? null;
  }
}
