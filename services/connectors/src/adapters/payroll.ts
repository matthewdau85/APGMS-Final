import {
  SecureConnectorAdapter,
  type ConnectorAdapterOptions,
  type ConnectorWebhookEnvelope,
} from "./base.js";

export interface PayrollSubmissionRequest {
  payRunId: string;
  orgExternalId: string;
  declaration: {
    name: string;
    position: string;
  };
  payload: unknown;
}

export interface PayrollSubmissionResponse {
  submissionId: string;
  receivedAt: string;
}

export type PayrollWebhookPayload =
  | {
      eventType: "stp.accepted";
      submissionId: string;
      payRunId: string;
      atoMessageId: string;
      acceptedAt: string;
    }
  | {
      eventType: "stp.rejected";
      submissionId: string;
      payRunId: string;
      reason: string;
      rejectedAt: string;
    }
  | ({ eventType: string } & Record<string, unknown>);

export interface PayrollConnectorOptions extends ConnectorAdapterOptions {
  onSubmissionAccepted?: (
    payload: Extract<PayrollWebhookPayload, { eventType: "stp.accepted" }>,
  ) => Promise<void>;
  onSubmissionRejected?: (
    payload: Extract<PayrollWebhookPayload, { eventType: "stp.rejected" }>,
  ) => Promise<void>;
}

export class PayrollConnector extends SecureConnectorAdapter<PayrollWebhookPayload> {
  constructor(private readonly payrollOptions: PayrollConnectorOptions) {
    super(payrollOptions);
  }

  public async submitStp(
    request: PayrollSubmissionRequest,
  ): Promise<PayrollSubmissionResponse> {
    const response = await this.authenticatedRequest({
      path: "/stp/submissions",
      method: "POST",
      body: JSON.stringify(request),
      retryAttempts: 3,
      retryDelayMs: 500,
    });

    if (response.status >= 400) {
      throw new Error(`payroll_submission_failed:${response.status}`);
    }

    const payload = JSON.parse(response.body) as PayrollSubmissionResponse;
    return payload;
  }

  public async pollSubmission(submissionId: string): Promise<unknown> {
    const response = await this.authenticatedRequest({
      path: `/stp/submissions/${encodeURIComponent(submissionId)}`,
      retryAttempts: 2,
    });

    if (response.status >= 400) {
      throw new Error(`payroll_submission_poll_failed:${response.status}`);
    }

    return JSON.parse(response.body) as unknown;
  }

  protected async onWebhook(
    envelope: ConnectorWebhookEnvelope<PayrollWebhookPayload>,
  ): Promise<void> {
    const payload = envelope.parsedBody;
    if (!payload || typeof payload !== "object") {
      throw new Error("payroll_webhook_unparseable");
    }

    switch (payload.eventType) {
      case "stp.accepted": {
        if (this.payrollOptions.onSubmissionAccepted) {
          await this.payrollOptions.onSubmissionAccepted(
            payload as Extract<PayrollWebhookPayload, { eventType: "stp.accepted" }>,
          );
        }
        break;
      }
      case "stp.rejected": {
        if (this.payrollOptions.onSubmissionRejected) {
          await this.payrollOptions.onSubmissionRejected(
            payload as Extract<PayrollWebhookPayload, { eventType: "stp.rejected" }>,
          );
        }
        break;
      }
      default: {
        // ignore
      }
    }
  }
}
