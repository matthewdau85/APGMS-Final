import { OAuth2Client } from "./oauth.js";
import { retry, type RetryOptions } from "./retry.js";
import { createSignature, verifySignature } from "./signature.js";

export interface BankingConnectorConfig {
  baseUrl: string;
  webhookSecret: string;
  oauth: OAuth2Client;
  fetchImpl?: typeof fetch;
  retry?: RetryOptions;
}

export interface BankTransactionFilter {
  accountId: string;
  since?: string;
  until?: string;
}

export interface BankTransaction {
  id: string;
  postedAt: string;
  description: string;
  amountCents: number;
  currency: string;
}

export interface InitiateDepositInput {
  accountId: string;
  amountCents: number;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface DepositResult {
  depositId: string;
  status: "accepted" | "pending";
}

export type WebhookEvent = {
  id: string;
  type: string;
  occurredAt: string;
  payload: unknown;
};

export class BankingConnectorClient {
  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof fetch;
  private readonly retryOptions: RetryOptions;

  constructor(private readonly config: BankingConnectorConfig) {
    this.baseUrl = new URL(config.baseUrl);
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.retryOptions = {
      maxAttempts: 4,
      baseDelayMs: 250,
      ...config.retry,
    };
  }

  async listTransactions(filter: BankTransactionFilter): Promise<BankTransaction[]> {
    if (!filter.accountId) {
      throw new Error("accountId is required when querying transactions");
    }

    const searchParams = new URLSearchParams({ accountId: filter.accountId });
    if (filter.since) {
      searchParams.set("since", filter.since);
    }
    if (filter.until) {
      searchParams.set("until", filter.until);
    }

    return this.request<BankTransaction[]>("GET", `/accounts/${encodeURIComponent(filter.accountId)}/transactions?${searchParams.toString()}`);
  }

  async initiateDeposit(input: InitiateDepositInput): Promise<DepositResult> {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error("Designated deposits must be a positive integer number of cents");
    }

    return this.request<DepositResult>("POST", `/accounts/${encodeURIComponent(input.accountId)}/deposits`, {
      body: {
        amountCents: input.amountCents,
        reference: input.reference,
        metadata: input.metadata ?? {},
      },
    });
  }

  async verifyWebhook(signature: string, timestamp: string, rawBody: string | Buffer): Promise<WebhookEvent | null> {
    const valid = verifySignature({ secret: this.config.webhookSecret }, { payload: rawBody, timestamp }, signature);
    if (!valid) {
      return null;
    }
    const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : JSON.parse(rawBody.toString("utf8"));
    return payload as WebhookEvent;
  }

  signPayload(timestamp: string, body: string | Buffer): string {
    return createSignature({ secret: this.config.webhookSecret }, { payload: body, timestamp });
  }

  private async request<T>(method: string, path: string, options: { body?: unknown } = {}): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const token = await this.config.oauth.getAccessToken();

    return retry(async () => {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const error = new Error(`Banking connector request failed with status ${response.status}`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    }, this.retryOptions);
  }
}
