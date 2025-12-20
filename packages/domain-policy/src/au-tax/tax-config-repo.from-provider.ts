import type { JurisdictionCode } from "../tax-types.js";
import { TaxType, type AuTaxConfigProvider, type TaxConfigRepository } from "./types.js";
import { resolveAuTaxConfig } from "./resolve-au-tax-config.js";

/**
 * Build a TaxConfigRepository from a provider.
 *
 * NOTE: This is intentionally simple and uses relative imports
 * (preferred inside a package).
 */
export function createTaxConfigRepositoryFromProvider(
  provider: AuTaxConfigProvider,
): TaxConfigRepository {
  return {
    async getPaygwConfig(jurisdiction: JurisdictionCode, onDate: Date) {
      return resolveAuTaxConfig({
        provider,
        jurisdiction,
        taxType: TaxType.PAYGW,
        onDate,
      }) as any;
    },

    async getGstConfig(jurisdiction: JurisdictionCode, onDate: Date) {
      return resolveAuTaxConfig({
        provider,
        jurisdiction,
        taxType: TaxType.GST,
        onDate,
      }) as any;
    },
  } as any;
}
