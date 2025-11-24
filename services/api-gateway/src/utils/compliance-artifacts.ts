// services/api-gateway/src/utils/compliance-artifacts.ts
import type { EvidenceArtifact } from "@prisma/client";

export function redactEvidenceArtifact(
  artifact: EvidenceArtifact | null | undefined,
  includePayload = false,
) {
  if (!artifact) return artifact;

  const metadata = {
    id: artifact.id,
    kind: artifact.kind,
    sha256: artifact.sha256,
    wormUri: artifact.wormUri,
    createdAt:
      artifact.createdAt instanceof Date
        ? artifact.createdAt.toISOString()
        : artifact.createdAt,
  };

  if (!includePayload) {
    return metadata;
  }

  return {
    ...metadata,
    payload: artifact.payload ?? null,
  };
}
