// webapp/src/ux/shared/data/evidence.ts
// ASCII only. LF newlines.

import { apiRequest } from "./apiClient";

export interface EvidencePackRequest {
  kind: string;
  payload?: Record<string, unknown>;
  wormUri?: string;
}

export interface EvidencePackResponse {
  id: string;
  createdAt: string;
  status: "pending" | "ready" | "failed";
}

export async function createEvidencePack(req: EvidencePackRequest, token?: string | null): Promise<EvidencePackResponse> {
  return apiRequest<EvidencePackResponse>("/api/evidence/packs", {
    method: "POST",
    token: token ?? null,
    body: req
  });
}

export async function listEvidencePacks(token?: string | null): Promise<EvidencePackResponse[]> {
  return apiRequest<EvidencePackResponse[]>("/api/evidence/packs", {
    method: "GET",
    token: token ?? null
  });
}
