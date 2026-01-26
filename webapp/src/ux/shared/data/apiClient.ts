import { getSession } from "../../auth";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:3000";

type ApiError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

function joinUrl(base: string, path: string): string {
  if (!path) return base;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) path = "/" + path;
  return base.replace(/\/+$/, "") + path;
}

function asHeaders(h?: HeadersInit): Headers {
  return h instanceof Headers ? new Headers(h) : new Headers(h || {});
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const url = joinUrl(API_BASE, path);

  const headers = asHeaders(opts.headers);
  headers.set("Accept", headers.get("Accept") || "application/json");

  const session = getSession();
  if (session?.token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  const init: RequestInit = {
    ...opts,
    headers,
    credentials: opts.credentials ?? "include",
  };

  const res = await fetch(url, init);

  if (res.status === 204) return undefined as unknown as T;

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const payload = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (res.ok) return payload as T;

  const err: ApiError = new Error(
    (payload && typeof payload === "object" && (payload as any).message) ||
      (typeof payload === "string" && payload) ||
      `Request failed (${res.status})`
  );

  err.status = res.status;
  if (payload && typeof payload === "object") {
    err.code = (payload as any).code;
    err.details = (payload as any).details ?? payload;
  } else {
    err.details = payload;
  }

  throw err;
}
