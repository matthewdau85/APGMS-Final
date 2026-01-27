// webapp/src/ux/shared/data/regulator.ts
// ASCII only. LF newlines.

import { apiRequest } from "./apiClient";

export interface RegulatorLoginRequest {
  accessCode: string;
}

export interface RegulatorSession {
  token: string;
  expiresAt: string;
  regulatorId: string;
}

export async function regulatorLogin(req: RegulatorLoginRequest): Promise<RegulatorSession> {
  return apiRequest<RegulatorSession>("/api/regulator/login", {
    method: "POST",
    body: req
  });
}

export interface RegulatorOrgSummary {
  orgId: string;
  name: string;
  abn?: string;
}

export async function regulatorListOrgs(token: string): Promise<RegulatorOrgSummary[]> {
  return apiRequest<RegulatorOrgSummary[]>("/api/regulator/orgs", {
    method: "GET",
    token
  });
}
