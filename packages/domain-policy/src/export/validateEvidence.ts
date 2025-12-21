import { EvidencePackV1 } from "./evidence.schema";

export function validateEvidenceOrThrow(e: EvidencePackV1): void {
  const missing: string[] = [];

  if (!e.inputDataHash) missing.push("inputDataHash");

  if (!e.taxSpec?.id) missing.push("taxSpec.id");
  if (!e.taxSpec?.version) missing.push("taxSpec.version");
  if (!e.taxSpec?.jurisdiction) missing.push("taxSpec.jurisdiction");
  if (!e.taxSpec?.effectivePeriod) missing.push("taxSpec.effectivePeriod");

  if (!e.computation?.timestamp) missing.push("computation.timestamp");
  if (!e.computation?.systemVersion) missing.push("computation.systemVersion");
  if (!e.computation?.readinessSnapshot) missing.push("computation.readinessSnapshot");

  if (!e.outputs?.obligations) missing.push("outputs.obligations");
  if (!e.outputs?.ledgerEntryIds?.length) missing.push("outputs.ledgerEntryIds");

  if (missing.length > 0) {
    throw new Error(
      `Evidence export refused: missing required fields: ${missing.join(", ")}`
    );
  }
}
