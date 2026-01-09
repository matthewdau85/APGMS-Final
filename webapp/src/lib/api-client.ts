// webapp/src/lib/api-client.ts
export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  orgId?: string;
};

const DEFAULT_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.toString?.() ?? "http://localhost:3001";

export async function apiRequest<T>(path: string, opts: ApiRequestOptions = {}): Promise<T> {
  const url = `${DEFAULT_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(opts.headers ?? {}),
  };

  if (opts.orgId) {
    headers["x-org-id"] = opts.orgId;
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    credentials: "include", // IMPORTANT: send apgms_session cookie
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let details = "";
    try {
      details = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`API ${res.status} ${res.statusText}${details ? `: ${details}` : ""}`);
  }

  return (await res.json()) as T;
}
