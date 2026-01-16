import { timingSafeEqual } from "crypto";
import type { EvidencePackV1 } from "./evidence.schema.js";
import { computeEvidenceChecksum } from "./evidenceChecksum.js";

/**
 * Verifies the checksum embedded in an evidence pack.
 * Accepts either `checksum` or `evidenceChecksum` on the object.
 */
export function verifyEvidenceChecksum(e: EvidencePackV1): boolean {
  const rec = e as unknown as Record<string, unknown>;
  const given = (rec.checksum ?? rec.evidenceChecksum) as unknown;

  if (typeof given !== "string" || given.length === 0) return false;

  const expected = computeEvidenceChecksum(e);
  return timingSafeEqualHex(given, expected);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
