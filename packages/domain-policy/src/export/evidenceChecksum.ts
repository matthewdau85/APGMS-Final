import { createHash } from "node:crypto";
import { canonicalJson } from "./canonicalJson.js";
import type { EvidencePackV1 } from "./evidence.schema.js";

export function computeEvidenceChecksum(pack: EvidencePackV1): string {
  const json = canonicalJson(pack);
  return createHash("sha256").update(json, "utf8").digest("hex");
}
