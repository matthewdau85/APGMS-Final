import { OAuth2Client, retry, type RetryOptions } from "../../connectors/src/index.js";

export interface AtoClientOptions {
  baseUrl: string;
  oauth: OAuth2Client;
  fetchImpl?: typeof fetch;
  retry?: RetryOptions;
}

export interface BasSubmissionPayload {
  orgId: string;
  period: { start: string; end: string };
  gstCollectedCents: number;
  gstPaidCents: number;
  paygwWithheldCents: number;
  declaration: string;
}

export interface BasSubmissionResult {
  reference: string;
  status: "accepted" | "pending";
}

export interface StpReportPayload {
  orgId: string;
  payRunId: string;
  lodgementDate: string;
  employees: Array<{
    employeeId: string;
    grossCents: number;
    paygwCents: number;
    superCents: number;
  }>;
}

export interface StpReportResult {
  receipt: string;
  status: "accepted" | "pending";
}

export interface BasPaymentSchedulePayload {
  orgId: string;
  amountCents: number;
  dueDate: string;
  reference: string;
}

export interface BasPaymentScheduleResult {
  scheduleId: string;
  status: "queued" | "submitted";
}

export class AtoClient {
  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof fetch;
  private readonly retryOptions: RetryOptions;

  constructor(private readonly options: AtoClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.retryOptions = {
      maxAttempts: 4,
      baseDelayMs: 300,
      ...options.retry,
    };
  }

  async submitBas(payload: BasSubmissionPayload): Promise<BasSubmissionResult> {
    return this.request("POST", "/bas/submissions", payload);
  }

  async submitStpReport(payload: StpReportPayload): Promise<StpReportResult> {
    return this.request("POST", "/stp/reports", payload);
  }

  async scheduleBasPayment(payload: BasPaymentSchedulePayload): Promise<BasPaymentScheduleResult> {
    return this.request("POST", "/bas/payments", payload);
  }

  private async request<T>(method: string, path: string, body: unknown): Promise<T> {
    const token = await this.options.oauth.getAccessToken();
    const url = new URL(path, this.baseUrl);

    return retry(async () => {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = new Error(`ATO request failed with status ${response.status}`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }

      return (await response.json()) as T;
    }, this.retryOptions);
  }
}
