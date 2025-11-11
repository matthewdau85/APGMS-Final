import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";

export interface OAuthConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  audience?: string;
}

export interface HttpClientOptions {
  baseUrl: string;
  oauth: OAuthConfig;
  userAgent?: string;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export abstract class AtoHttpClient {
  private token: { accessToken: string; tokenType: string; expiresAt: number } | null = null;

  protected constructor(protected readonly options: HttpClientOptions) {}

  protected async get(path: string): Promise<{ status: number; body: string }> {
    return this.request({ method: "GET", path });
  }

  protected async post(path: string, body: JsonValue): Promise<{ status: number; body: string }> {
    return this.request({ method: "POST", path, body });
  }

  private async request(input: {
    method: string;
    path: string;
    body?: JsonValue;
    retries?: number;
  }): Promise<{ status: number; body: string }> {
    const retries = input.retries ?? 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const token = await this.ensureToken();
        const url = new URL(input.path, this.options.baseUrl);
        const payload = input.body !== undefined ? JSON.stringify(input.body) : undefined;

        const headers: Record<string, string> = {
          Authorization: `${token.tokenType} ${token.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        };

        if (this.options.userAgent) {
          headers["User-Agent"] = this.options.userAgent;
        }

        const response = await sendHttpRequest({
          method: input.method,
          url: url.toString(),
          headers,
          body: payload,
        });

        if (response.status >= 500 && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (attempt >= retries) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("ato_http_failure");
  }

  private async ensureToken(): Promise<{ accessToken: string; tokenType: string }> {
    if (this.token && this.token.expiresAt - 60_000 > Date.now()) {
      return { accessToken: this.token.accessToken, tokenType: this.token.tokenType };
    }

    const next = await requestClientCredentialsToken(this.options.oauth);
    this.token = next;
    return { accessToken: next.accessToken, tokenType: next.tokenType };
  }
}

async function requestClientCredentialsToken(
  config: OAuthConfig,
): Promise<{ accessToken: string; tokenType: string; expiresAt: number }>
{
  const params = new URLSearchParams();
  params.set("grant_type", "client_credentials");
  params.set("client_id", config.clientId);
  params.set("client_secret", config.clientSecret);
  if (config.scope) {
    params.set("scope", config.scope);
  }
  if (config.audience) {
    params.set("audience", config.audience);
  }

  const response = await sendHttpRequest({
    method: "POST",
    url: config.tokenUrl,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`oauth_failure:${response.status}`);
  }

  const payload = JSON.parse(response.body) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
  };

  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type ?? "Bearer",
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
}

async function sendHttpRequest(input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; body: string }> {
  const url = new URL(input.url);
  const handler = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const req = handler(
      url,
      {
        method: input.method,
        headers: input.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.on("error", reject);

    if (input.body) {
      req.write(input.body);
    }

    req.end();
  });
}
