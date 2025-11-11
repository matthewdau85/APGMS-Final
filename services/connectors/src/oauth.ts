import { request as httpsRequest, type RequestOptions } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";

import type {
  HttpRequest,
  HttpResponse,
  OAuthClientCredentialsConfig,
  HttpTransport,
} from "./types.js";

function isHttps(url: URL): boolean {
  return url.protocol === "https:";
}

function buildRequestOptions(url: URL, options: RequestOptions): RequestOptions {
  return {
    hostname: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    path: `${url.pathname}${url.search}`,
    method: options.method,
    headers: options.headers,
  };
}

function defaultTransport(request: HttpRequest): Promise<HttpResponse> {
  return new Promise<HttpResponse>((resolve, reject) => {
    const url = new URL(request.url);
    const body = typeof request.body === "string" || request.body instanceof Buffer
      ? request.body
      : undefined;

    const options: RequestOptions = {
      method: request.method,
      headers: request.headers,
    };

    const handler = isHttps(url) ? httpsRequest : httpRequest;
    const req = handler(buildRequestOptions(url, options), (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const payload = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: res.statusCode ?? 0,
          headers: Object.fromEntries(
            Object.entries(res.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(",") : value ?? "",
            ]),
          ),
          body: payload,
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (body !== undefined) {
      req.write(body);
    }

    req.end();
  });
}

export async function requestClientCredentialsToken(
  config: OAuthClientCredentialsConfig,
  transport: HttpTransport = defaultTransport,
): Promise<{ accessToken: string; expiresAt: Date; tokenType: string }>
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

  const response = await transport({
    method: "POST",
    url: config.tokenUrl,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `oauth_token_request_failed:${response.status}`,
    );
  }

  const payload = JSON.parse(response.body) as {
    access_token: string;
    expires_in?: number;
    token_type?: string;
  };

  const expiresIn = payload.expires_in ?? 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const tokenType = payload.token_type ?? "Bearer";

  return {
    accessToken: payload.access_token,
    expiresAt,
    tokenType,
  };
}
