import { OAuth2TokenManager } from "../utils/oauth2.js";
import { ReplayProtector } from "../security/replay-protector.js";
import { SignatureVerifier } from "../security/signature-verifier.js";
import type {
  BankingConnectorConfig,
  BankingTransaction,
  ConnectorFetchOptions,
  ConnectorSubmissionResult,
  SignedPayload,
} from "../types.js";
import { BaseConnector } from "./base.js";

export interface BankingDisbursementRequest {
  orgId: string;
  reference: string;
  description?: string;
  amountCents: number;
  currency: string;
  counterpartyName: string;
  counterpartyBsb: string;
  counterpartyAccount: string;
}

export class BankingConnector extends BaseConnector<
  BankingDisbursementRequest,
  ConnectorSubmissionResult
> {
  private readonly config: BankingConnectorConfig;

  constructor(config: BankingConnectorConfig) {
    super({
      oauthManager: new OAuth2TokenManager(config.oauth),
      replayProtector: new ReplayProtector(),
      signatureVerifier: new SignatureVerifier({
        publicCertificate: config.signingCert,
      }),
    });

    this.config = config;
  }

  async submit(payload: BankingDisbursementRequest): Promise<ConnectorSubmissionResult> {
    const response = await this.authorisedFetch(`${this.config.apiBaseUrl}/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        orgId: payload.orgId,
        reference: payload.reference,
        description: payload.description,
        amount: payload.amountCents,
        currency: payload.currency,
        counterparty: {
          name: payload.counterpartyName,
          bsb: payload.counterpartyBsb,
          accountNumber: payload.counterpartyAccount,
        },
        environment: this.config.environment,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new Error(`Banking disbursement failed: ${response.status} ${body}`);
    }

    return (await response.json()) as ConnectorSubmissionResult;
  }

  async fetch(options: ConnectorFetchOptions = {}): Promise<BankingTransaction[]> {
    const url = new URL(`${this.config.apiBaseUrl}/transactions`);
    if (options.since) {
      url.searchParams.set("since", options.since);
    }
    if (options.until) {
      url.searchParams.set("until", options.until);
    }
    if (options.limit) {
      url.searchParams.set("limit", String(options.limit));
    }

    const response = await this.authorisedFetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to fetch banking transactions: ${response.status} ${body}`);
    }

    return (await response.json()) as BankingTransaction[];
  }

  async handleWebhook(message: SignedPayload): Promise<BankingTransaction> {
    await this.validateInbound(message);
    return message.payload as BankingTransaction;
  }
}

