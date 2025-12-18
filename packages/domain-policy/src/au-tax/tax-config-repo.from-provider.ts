// packages/domain-policy/src/au-tax/tax-config-repo.from-provider.ts

import type { JurisdictionCode } from "../tax-types.js";
import { resolveAuTaxConfig } from "./resolve-au-tax-config.js";
import {
  TaxType,
  type AuTaxConfig,
  type AuTaxConfigProvider,
  type GstConfig,
  type PayPeriod,
  type PaygwConfig,
  type TaxConfigRepository,
} from "./types.js";

export function createTaxConfigRepositoryFromProvider(
  provider: AuTaxConfigProvider,
): TaxConfigRepository {
  return {
    async getActiveConfig(params: {
      jurisdiction: JurisdictionCode;
      taxType: TaxType;
      onDate: Date;
    }): Promise<AuTaxConfig | null> {
      const { jurisdiction, taxType, onDate } = params;

      if (taxType !== TaxType.PAYGW && taxType !== TaxType.GST) {
        return null;
      }

      return await resolveAuTaxConfig({
        provider,
        jurisdiction,
        taxType,
        onDate,
      });
    },

    async getPaygwConfigForSchedule(
      jurisdiction: JurisdictionCode,
      payPeriod: PayPeriod,
      onDate: Date,
    ): Promise<PaygwConfig | null> {
      const cfg = await resolveAuTaxConfig({
        provider,
        jurisdiction,
        taxType: TaxType.PAYGW,
        onDate,
      });

      // attach period hint (engine will still accept a period input)
      return { ...(cfg as PaygwConfig), payPeriod };
    },

    async getGstConfig(
      jurisdiction: JurisdictionCode,
      onDate: Date,
    ): Promise<GstConfig | null> {
      const cfg = await resolveAuTaxConfig({
        provider,
        jurisdiction,
        taxType: TaxType.GST,
        onDate,
      });
      return cfg as GstConfig;
    },
  };
}
