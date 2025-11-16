import { URL } from "node:url";

export type NabClientConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  defaultReferencePrefix?: string;
};

export type NabCreditRequest = {
  orgId: string;
  accountId: string;
  amountCents: number;
  reference: string;
};

export type NabCreditResponse = {
  reference: string;
  status: "accepted" | "queued" | "failed";
};

export class NabClientError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "NabClientError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function sanitizeBaseUrl(value: string): string {
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  // validate URL eagerly so misconfiguration fails fast
  // eslint-disable-next-line no-new
  new URL(normalized);
  return normalized;
}

const VALID_STATUSES: ReadonlySet<NabCreditResponse["status"]> = new Set([
  "accepted",
  "queued",
  "failed",
]);

function normalizeStatus(value: unknown): NabCreditResponse["status"] {
  if (typeof value === "string" && VALID_STATUSES.has(value as NabCreditResponse["status"])) {
    return value as NabCreditResponse["status"];
  }

  return "queued";
}

export class NabClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: typeof fetch;
  private readonly referencePrefix: string;

  constructor(config: NabClientConfig, fetchImpl: typeof fetch = fetch) {
    this.baseUrl = sanitizeBaseUrl(config.baseUrl);
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.fetchImpl = fetchImpl;
    this.referencePrefix = config.defaultReferencePrefix ?? "APGMS";
  }

  private buildHeaders(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-client-id": this.clientId,
      authorization: `Bearer ${this.clientSecret}`,
    };
  }

  private buildPayload(request: NabCreditRequest) {
    return {
      orgId: request.orgId,
      accountId: request.accountId,
      cents: request.amountCents,
      reference: `${this.referencePrefix}-${request.reference}`.slice(0, 40),
    };
  }

  async creditDesignatedAccount(request: NabCreditRequest): Promise<NabCreditResponse> {
    const endpoint = `${this.baseUrl}/designated-accounts/${request.accountId}/credits`;
    const res = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(this.buildPayload(request)),
    });

    const text = await res.text();
    const parsed = text.length > 0 ? (() => {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    })() : undefined;

    if (!res.ok) {
      throw new NabClientError(
        res.status,
        `NAB credit API rejected request with status ${res.status}`,
        parsed ?? text,
      );
    }

    return {
      reference: String(parsed?.reference ?? parsed?.id ?? request.reference),
      status: normalizeStatus(parsed?.status),
    };
  }
}
