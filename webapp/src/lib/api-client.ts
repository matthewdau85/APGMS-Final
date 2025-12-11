// webapp/src/lib/api-client.ts

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

/**
 * Simple JSON fetch wrapper.
 * - Attaches X-Org-Id if provided.
 * - Throws on non-2xx responses.
 */
export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    orgId?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.orgId) {
    headers["x-org-id"] = options.orgId;
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `API error ${res.status} ${res.statusText} for ${url}: ${text}`,
    );
  }

  return (await res.json()) as T;
}
