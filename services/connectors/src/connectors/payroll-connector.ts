import { OAuth2TokenManager } from "../utils/oauth2.js";
import { ReplayProtector } from "../security/replay-protector.js";
import { SignatureVerifier } from "../security/signature-verifier.js";
import type {
  ConnectorFetchOptions,
  ConnectorSubmissionResult,
  PayrollConnectorConfig,
  PayrollEvent,
  SignedPayload,
} from "../types.js";
import { BaseConnector } from "./base.js";

export interface PayrollDeclarationRequest {
  orgId: string;
  payRunReference: string;
  declarationReference: string;
  grossAmountCents: number;
  paygWithheldCents: number;
  superAccruedCents: number;
  employeeCount: number;
  lodgedBy: string;
}

export class PayrollConnector extends BaseConnector<
  PayrollDeclarationRequest,
  ConnectorSubmissionResult
> {
  private readonly config: PayrollConnectorConfig;

  constructor(config: PayrollConnectorConfig) {
    super({
      oauthManager: new OAuth2TokenManager(config.oauth),
      replayProtector: new ReplayProtector(),
      signatureVerifier: new SignatureVerifier({
        publicCertificate: config.signingCert,
      }),
    });

    this.config = config;
  }

  async submit(payload: PayrollDeclarationRequest): Promise<ConnectorSubmissionResult> {
    const response = await this.authorisedFetch(`${this.config.apiBaseUrl}/declarations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        orgId: payload.orgId,
        payRunReference: payload.payRunReference,
        declarationReference: payload.declarationReference,
        grossAmount: payload.grossAmountCents,
        paygWithheld: payload.paygWithheldCents,
        superAccrued: payload.superAccruedCents,
        employeeCount: payload.employeeCount,
        lodgedBy: payload.lodgedBy,
        environment: this.config.environment,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new Error(`Payroll declaration failed: ${response.status} ${body}`);
    }

    return (await response.json()) as ConnectorSubmissionResult;
  }

  async fetch(options: ConnectorFetchOptions = {}): Promise<PayrollEvent[]> {
    const url = new URL(`${this.config.apiBaseUrl}/events`);
    if (options.since) {
      url.searchParams.set("since", options.since);
    }
    if (options.until) {
      url.searchParams.set("until", options.until);
    }
    if (options.limit) {
      url.searchParams.set("limit", String(options.limit));
    }

    const response = await this.authorisedFetch(url, { method: "GET" });
    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to fetch payroll events: ${response.status} ${body}`);
    }

    return (await response.json()) as PayrollEvent[];
  }

  async handleWebhook(message: SignedPayload): Promise<PayrollEvent> {
    await this.validateInbound(message);
    return message.payload as PayrollEvent;
  }
}

