import { OAuth2Client } from "./oauth.js";
import { retry, type RetryOptions } from "./retry.js";

export interface PayrollConnectorConfig {
  baseUrl: string;
  oauth: OAuth2Client;
  fetchImpl?: typeof fetch;
  retry?: RetryOptions;
}

export interface StpSubmissionPayload {
  payRunId: string;
  employees: Array<{
    employeeId: string;
    grossPayCents: number;
    paygwWithheldCents: number;
    superAccruedCents: number;
  }>;
  submittedBy: string;
  declaration: string;
}

export interface StpSubmissionResult {
  receiptId: string;
  status: "accepted" | "pending";
  lodgementReference: string;
}

export interface PayrollWebhookEvent {
  id: string;
  type: "payrun.completed" | "employee.updated" | string;
  payload: unknown;
  occurredAt: string;
}

export class PayrollConnectorClient {
  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof fetch;
  private readonly retryOptions: RetryOptions;

  constructor(private readonly config: PayrollConnectorConfig) {
    this.baseUrl = new URL(config.baseUrl);
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.retryOptions = {
      maxAttempts: 4,
      baseDelayMs: 250,
      ...config.retry,
    };
  }

  async submitStp(payload: StpSubmissionPayload): Promise<StpSubmissionResult> {
    return this.request<StpSubmissionResult>("POST", "/stp/submissions", { body: payload });
  }

  async fetchPayRun(payRunId: string): Promise<unknown> {
    return this.request("GET", `/pay-runs/${encodeURIComponent(payRunId)}`);
  }

  async acknowledgeWebhook(event: PayrollWebhookEvent & { acknowledgementUrl: string }): Promise<void> {
    await this.request("POST", event.acknowledgementUrl, { body: { receivedAt: new Date().toISOString() } });
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
        const error = new Error(`Payroll connector request failed with status ${response.status}`) as Error & { status: number };
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
