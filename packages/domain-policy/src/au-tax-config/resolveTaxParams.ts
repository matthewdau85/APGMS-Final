// packages/domain-policy/src/au-tax-config/resolveTaxParams.ts

import type {
  AuTaxConfigProvider,
  AuTaxParameterSet,
  AuTaxRateTable,
  AuTaxRateTableKind,
  AuTaxType,
} from "./types.js";

export type ResolvedAuTaxConfig = {
  parameterSet: AuTaxParameterSet;
  getTable(kind: AuTaxRateTableKind): AuTaxRateTable;
};

export async function resolveTaxParameterSet(
  provider: AuTaxConfigProvider,
  taxType: AuTaxType,
  asOf: Date,
): Promise<ResolvedAuTaxConfig> {
  const set = await provider.findActiveParameterSet({ taxType, asOf });

  if (!set) {
    throw new Error(
      `TAX_CONFIG_MISSING: Missing ACTIVE AU tax parameter set taxType=${taxType} asOf=${asOf.toISOString()}`,
    );
  }

  const byKind = new Map(set.tables.map((t) => [t.kind, t] as const));

  return {
    parameterSet: set,
    getTable(kind) {
      const t = byKind.get(kind);
      if (!t) {
        throw new Error(
          `TAX_CONFIG_MISSING_TABLE: Missing required table kind=${kind} for parameterSetId=${set.id} taxType=${set.taxType}`,
        );
      }
      return t;
    },
  };
}
