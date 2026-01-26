// ASCII only
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000";
const ENV_ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || "";

const LS_KEY = "apgms_admin_token_v1";

type ApiError = { error?: { code?: string; message?: string } };

export function getAdminToken(): string {
  const v = localStorage.getItem(LS_KEY);
  return (v && v.trim().length > 0 ? v.trim() : ENV_ADMIN_TOKEN).trim();
}

export function setAdminToken(token: string): void {
  const t = String(token || "").trim();
  if (!t) {
    localStorage.removeItem(LS_KEY);
    return;
  }
  localStorage.setItem(LS_KEY, t);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = getAdminToken();
  if (token) {
    headers["x-admin-token"] = token;
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...authHeaders(),
      ...(opts.headers as any),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      (json as ApiError | null)?.error?.message ||
      (json as any)?.message ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json;
}

export async function fetchRegWatcherStatus() {
  return await apiFetch("/admin/regwatcher/status", { method: "GET" });
}

export async function runRegWatcher() {
  return await apiFetch("/admin/regwatcher/run", { method: "POST", body: JSON.stringify({}) });
}

export async function fetchAgentRuns() {
  return await apiFetch("/admin/agent/runs", { method: "GET" });
}

export async function fetchAgentRunById(id: string) {
  return await apiFetch(`/admin/agent/runs/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createAgentRun(job: "smoke" | "demo-stress" | "agent-suite", params?: any) {
  return await apiFetch("/admin/agent/runs", {
    method: "POST",
    body: JSON.stringify({ job, params: params ?? {} }),
  });
}
