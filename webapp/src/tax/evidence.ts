import type { TaxTypeId } from "./registry";

export type IsoDateOnly = string;

export type EvidenceRef = {
  taxType: TaxTypeId;
  pluginVersion: string;
  configId: string;
  specVersion: string;
  asAt: IsoDateOnly;
  evidencePackId: string;
  manifestHash: string;
  generatedAtUtc: string;
};

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function makeEvidenceRef(args: {
  taxType: TaxTypeId;
  pluginVersion: string;
  configId: string;
  specVersion: string;
  asAt: IsoDateOnly;
}): EvidenceRef {
  const evidencePackId = `${args.taxType}:${args.configId}:${args.asAt}`;
  const manifestPayload = {
    taxType: args.taxType,
    pluginVersion: args.pluginVersion,
    configId: args.configId,
    specVersion: args.specVersion,
    asAt: args.asAt,
    evidencePackId,
  };
  const manifestHash = fnv1a(JSON.stringify(manifestPayload));

  return {
    taxType: args.taxType,
    pluginVersion: args.pluginVersion,
    configId: args.configId,
    specVersion: args.specVersion,
    asAt: args.asAt,
    evidencePackId,
    manifestHash,
    generatedAtUtc: new Date().toISOString(),
  };
}
