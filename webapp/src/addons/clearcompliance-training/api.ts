// webapp/src/addons/clearcompliance-training/api.ts
export type OrgSettings = {
  addons: {
    clearComplianceTraining: boolean;
  };
};

export type TrainingCatalog = {
  programId: string;
  programName: string;
  version: string;
  modules: Array<{
    moduleId: string;
    title: string;
    summary: string;
    requirements: Array<{
      requirementId: string;
      title: string;
      description: string;
      evidence: Array<{
        evidenceId: string;
        title: string;
        description: string;
        artifactTypes: string[];
      }>;
      gates: Array<{
        gateId: string;
        title: string;
        passRule: string;
      }>;
    }>;
  }>;
};

function apiBase(): string {
  const v = (import.meta as any).env?.VITE_API_BASE_URL;
  if (typeof v === "string" && v.trim()) return v.trim();
  return "http://127.0.0.1:3000";
}

function getBearerToken(): string | null {
  // Best-effort only. Replace with your real session helper if available.
  const keys = ["token", "apgms_token", "access_token"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }
  return null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getBearerToken();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}

export async function getOrgSettings(): Promise<OrgSettings> {
  return await fetchJson<OrgSettings>("/org/settings", { method: "GET" });
}

export async function patchOrgSettings(
  partial: Partial<OrgSettings>
): Promise<{ ok: boolean; addons: OrgSettings["addons"] }> {
  return await fetchJson<{ ok: boolean; addons: OrgSettings["addons"] }>(
    "/org/settings",
    {
      method: "PATCH",
      body: JSON.stringify(partial),
    }
  );
}

export async function getTrainingCatalog(): Promise<TrainingCatalog> {
  return await fetchJson<TrainingCatalog>("/training/catalog", { method: "GET" });
}
