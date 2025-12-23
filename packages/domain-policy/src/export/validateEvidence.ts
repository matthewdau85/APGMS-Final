import type { EvidencePackV1 } from "./evidence.schema.js";

export function validateEvidencePackV1(candidate: unknown): candidate is EvidencePackV1 {
  return typeof candidate === "object" && candidate !== null;
}
