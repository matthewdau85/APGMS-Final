export function verifyEvidenceChecksum(e: EvidencePackV1): boolean {
  const expected = computeEvidenceChecksum(e);
  return expected === e.checksum;
}
