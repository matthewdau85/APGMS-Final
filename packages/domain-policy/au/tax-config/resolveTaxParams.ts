import type {
  AuTaxParameterSet,
  AuTaxRateTable,
  AuTaxRateTableKind,
  AuTaxType,
} from "./types.js";

export type AuTaxConfigProvider = {
  findActiveParameterSet(args: {
    taxType: AuTaxType;
    asOf: Date;
  }): Promise<AuTaxParameterSet | null>;
};

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
      `Missing ACTIVE AU tax parameter set for taxType=${taxType} asOf=${asOf.toISOString().slice(0, 10)}`,
    );
  }

  const byKind = new Map(set.tables.map((t) => [t.kind, t] as const));

  return {
    parameterSet: set,
    getTable(kind) {
      const t = byKind.get(kind);
      if (!t) {
        throw new Error(
          `Missing required rate table kind=${kind} for parameterSetId=${set.id} taxType=${set.taxType}`,
        );
      }
      return t;
    },
  };
}
