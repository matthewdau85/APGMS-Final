type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
  orgId?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function apiRequest<T>(
  path: string,
  opts: ApiRequestOptions = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(opts.headers ?? {}),
  };

  if (opts.token) {
    headers.authorization = `Bearer ${opts.token}`;
  }

  if (opts.orgId) {
    headers["x-org-id"] = opts.orgId;
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`API ${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}
