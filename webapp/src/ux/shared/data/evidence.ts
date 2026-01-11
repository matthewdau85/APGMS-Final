import { apiRequest } from "./apiClient";

export type EvidenceArtifact = {
  id: string;
  kind: string;
  sha256: string;
  wormUri: string | null;
  createdAt: string;
};

export async function fetchEvidenceArtifacts(token: string) {
  return apiRequest<{ artifacts: EvidenceArtifact[] }>("/compliance/evidence", {
    token,
  });
}

export async function createEvidenceArtifact(
  token: string,
  payload: { kind: string; payload?: Record<string, unknown>; wormUri?: string }
) {
  return apiRequest<{ artifact: { id: string } }>("/compliance/evidence", {
    method: "POST",
    token,
    body: payload,
  });
}
