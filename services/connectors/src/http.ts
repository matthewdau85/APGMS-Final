import { setTimeout as delay } from "node:timers/promises";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequest = {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  retry?: { attempts: number; backoffMs: number };
};

export type HttpResponse<TBody = unknown> = {
  status: number;
  headers: Record<string, string>;
  body: TBody;
};

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly request: HttpRequest,
    public readonly status: number,
    public readonly responseBody: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function parseBody<T>(response: any): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  const text = await response.text();
  return text as unknown as T;
}

export class HttpClient {
  constructor(private readonly defaults: { baseUrl: string; headers?: Record<string, string> }) {}

  async request<TBody = unknown>(request: HttpRequest): Promise<HttpResponse<TBody>> {
    const { retry } = request;
    const attempts = retry?.attempts ?? 1;
    const backoffMs = retry?.backoffMs ?? 250;

    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const url = request.url.startsWith("http")
          ? request.url
          : `${this.defaults.baseUrl.replace(/\/$/, "")}/${request.url.replace(/^\//, "")}`;

        const response = await fetch(url, {
          method: request.method,
          headers: {
            "content-type": "application/json",
            ...this.defaults.headers,
            ...request.headers,
          },
          body: request.body ? JSON.stringify(request.body) : undefined,
        });

        if (!response.ok) {
          const body = await parseBody<unknown>(response);
          throw new HttpError(
            `Request to ${url} failed with status ${response.status}`,
            request,
            response.status,
            body,
          );
        }

        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: await parseBody<TBody>(response),
        };
      } catch (error) {
        lastError = error;
        if (attempt < attempts - 1) {
          await delay(backoffMs * (attempt + 1));
          continue;
        }
        throw error;
      }
    }

    throw lastError ?? new Error("http_request_failed");
  }
}
