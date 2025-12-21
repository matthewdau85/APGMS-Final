import crypto from "crypto";
import { canonicalJson } from "./canonicalJson";
import { EvidencePackV1 } from "./evidence.schema";

export function computeEvidenceChecksum(e: EvidencePackV1): string {
  const clone = { ...e };
  delete (clone as any).checksum;

  const canonical = canonicalJson(clone);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
