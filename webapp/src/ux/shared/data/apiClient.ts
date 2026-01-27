// webapp/src/ux/shared/data/apiClient.ts
// ASCII only. LF newlines.

import { getAuthHeader, getSession } from "../../../auth";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:3000";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  method?: ApiMethod;
  token?: string | null;
  orgId?: string | null;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiErrorShape {
  status: number;
  message: string;
  details?: unknown;
}

function buildHeaders(opts: ApiRequestOptions): Record<string, string> {
  const session = getSession();
  const token = opts.token ?? session?.token ?? null;
  const orgId = opts.orgId ?? session?.user?.orgId ?? null;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers ?? {}),
    ...getAuthHeader(token)
  };

  if (orgId) headers["X-Org-Id"] = orgId;

  return headers;
}

export async function apiRequest<T = unknown>(path: string, opts: ApiRequestOptions = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const method: ApiMethod = opts.method ?? "GET";
  const headers = buildHeaders(opts);

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    signal: opts.signal
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    const details = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
    const err: ApiErrorShape = {
      status: res.status,
      message: `API ${method} ${path} failed (${res.status})`,
      details
    };
    throw err;
  }

  if (res.status === 204) return undefined as T;
  if (isJson) return (await res.json()) as T;

  // Fallback: if server returns text
  return (await res.text()) as unknown as T;
}
