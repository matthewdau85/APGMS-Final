import { setTimeout as delay } from "node:timers/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";

import { requestClientCredentialsToken } from "../oauth.js";
import { ReplayProtector, verifyHmacSignature } from "../security.js";
import { SlaTracker } from "../sla.js";
import type {
  HttpResponse,
  HttpTransport,
  OAuthClientCredentialsConfig,
  WebhookSecurityConfig,
} from "../types.js";

export interface ConnectorWebhookEnvelope<T = unknown> {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  parsedBody: T;
  messageId: string;
  receivedAt?: Date;
}

export interface ConnectorAdapterOptions {
  name: string;
  baseUrl: string;
  oauth: OAuthClientCredentialsConfig;
  webhook: WebhookSecurityConfig;
  transport?: HttpTransport;
  replayProtector?: ReplayProtector;
  slaTracker?: SlaTracker;
}

export interface RequestOptions {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export abstract class SecureConnectorAdapter<TWebhook = unknown> {
  private accessToken: { token: string; expiresAt: Date; type: string } | null = null;

  private readonly replayProtector: ReplayProtector;
  private readonly slaTracker: SlaTracker;
  private readonly transport: HttpTransport;

  protected constructor(private readonly options: ConnectorAdapterOptions) {
    const toleranceMs = (options.webhook.toleranceSeconds ?? 300) * 1000;
    this.replayProtector = options.replayProtector ?? new ReplayProtector(toleranceMs);
    this.slaTracker = options.slaTracker ?? new SlaTracker(1_500);
    this.transport = options.transport ?? this.defaultTransport.bind(this);
  }

  public async processWebhook(envelope: ConnectorWebhookEnvelope<TWebhook>): Promise<void> {
    this.assertWebhook(envelope);
    await this.onWebhook(envelope);
  }

  protected abstract onWebhook(envelope: ConnectorWebhookEnvelope<TWebhook>): Promise<void>;

  protected async authenticatedRequest(options: RequestOptions): Promise<HttpResponse> {
    const token = await this.getAccessToken();
    const url = new URL(options.path, this.options.baseUrl);

    const headers = {
      Authorization: `${token.type} ${token.token}`,
      Accept: "application/json",
      "Content-Type": options.body ? "application/json" : "application/json",
      ...options.headers,
    };

    return this.performRequest(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body: options.body,
      retryAttempts: options.retryAttempts,
      retryDelayMs: options.retryDelayMs,
    });
  }

  protected async performRequest(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | Buffer;
      retryAttempts?: number;
      retryDelayMs?: number;
    },
  ): Promise<HttpResponse> {
    const attempts = options.retryAttempts ?? 2;
    const baseDelay = options.retryDelayMs ?? 250;

    let lastError: unknown;

    for (let attempt = 0; attempt <= attempts; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await this.transport({
          method: options.method ?? "GET",
          url,
          headers: options.headers,
          body: options.body,
        });

        const elapsed = Date.now() - startedAt;
        this.slaTracker.record(elapsed);

        if (response.status >= 500 && attempt < attempts) {
          await delay(baseDelay * Math.pow(2, attempt));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        const elapsed = Date.now() - startedAt;
        this.slaTracker.record(elapsed);

        if (attempt >= attempts) {
          throw error;
        }

        await delay(baseDelay * Math.pow(2, attempt));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("request_failed");
  }

  protected slaMetrics() {
    return this.slaTracker.metrics();
  }

  private async getAccessToken(): Promise<{ token: string; type: string; expiresAt: Date }> {
    if (this.accessToken && this.accessToken.expiresAt.getTime() - 60_000 > Date.now()) {
      return this.accessToken;
    }

    const token = await requestClientCredentialsToken(this.options.oauth, this.transport);
    this.accessToken = {
      token: token.accessToken,
      type: token.tokenType,
      expiresAt: token.expiresAt,
    };
    return this.accessToken;
  }

  private assertWebhook(envelope: ConnectorWebhookEnvelope<TWebhook>): void {
    const signatureHeader = this.readHeader(envelope.headers, this.options.webhook.signatureHeader);
    if (!signatureHeader) {
      throw new Error(`${this.options.name}:missing_signature`);
    }

    const timestampValue = this.options.webhook.timestampHeader
      ? this.readHeader(envelope.headers, this.options.webhook.timestampHeader)
      : undefined;

    const canonicalPayload = timestampValue
      ? `${timestampValue}.${envelope.rawBody}`
      : envelope.rawBody;

    const verified = verifyHmacSignature(
      canonicalPayload,
      this.options.webhook.secret,
      signatureHeader,
      this.options.webhook.algorithm,
    );

    if (!verified) {
      throw new Error(`${this.options.name}:invalid_signature`);
    }

    const toleranceMs = (this.options.webhook.toleranceSeconds ?? 300) * 1000;
    const timestampMs = this.resolveTimestampMs(timestampValue, envelope.receivedAt);

    if (timestampMs && Math.abs(Date.now() - timestampMs) > toleranceMs) {
      throw new Error(`${this.options.name}:stale_webhook`);
    }

    if (!this.replayProtector.register(envelope.messageId, timestampMs ?? Date.now())) {
      throw new Error(`${this.options.name}:replay_detected`);
    }
  }

  private resolveTimestampMs(value: string | undefined, receivedAt?: Date): number | undefined {
    if (!value) {
      return receivedAt?.getTime();
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      if (value.length <= 12) {
        return numeric * 1000;
      }
      return numeric;
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }

    return receivedAt?.getTime();
  }

  private readHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lower) {
        if (Array.isArray(value)) {
          return value[0];
        }
        return value ?? undefined;
      }
    }
    return undefined;
  }

  private async defaultTransport(request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
  }): Promise<HttpResponse> {
    return new Promise<HttpResponse>((resolve, reject) => {
      const target = new URL(request.url);
      const handler = target.protocol === "https:" ? httpsRequest : httpRequest;

      const req = handler(
        target,
        {
          method: request.method,
          headers: request.headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            resolve({
              status: res.statusCode ?? 0,
              headers: Object.fromEntries(
                Object.entries(res.headers).map(([key, value]) => [
                  key,
                  Array.isArray(value) ? value.join(",") : value ?? "",
                ]),
              ),
              body: Buffer.concat(chunks).toString("utf8"),
            });
          });
        },
      );

      req.on("error", reject);

      if (request.body) {
        req.write(request.body);
      }

      req.end();
    });
  }
}
