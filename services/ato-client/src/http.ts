export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH";

export type HttpOptions = {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export async function requestJson<T>(options: HttpOptions): Promise<T> {
  const response = await fetch(options.url, {
    method: options.method,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ATO request failed with ${response.status}: ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
