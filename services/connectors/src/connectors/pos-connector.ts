import { OAuth2TokenManager } from "../utils/oauth2.js";
import { ReplayProtector } from "../security/replay-protector.js";
import { SignatureVerifier } from "../security/signature-verifier.js";
import type {
  ConnectorFetchOptions,
  ConnectorSubmissionResult,
  PosConnectorConfig,
  PosSettlement,
  SignedPayload,
} from "../types.js";
import { BaseConnector } from "./base.js";

export interface PosBatchUploadRequest {
  orgId: string;
  batchReference: string;
  takingsCents: number;
  gstCollectedCents: number;
  cardVolumeCents: number;
  cashVolumeCents: number;
  openedAt: string;
  closedAt: string;
}

export class PosConnector extends BaseConnector<PosBatchUploadRequest, ConnectorSubmissionResult> {
  private readonly config: PosConnectorConfig;

  constructor(config: PosConnectorConfig) {
    super({
      oauthManager: new OAuth2TokenManager(config.oauth),
      replayProtector: new ReplayProtector(),
      signatureVerifier: new SignatureVerifier({
        publicCertificate: config.signingCert,
      }),
    });

    this.config = config;
  }

  async submit(payload: PosBatchUploadRequest): Promise<ConnectorSubmissionResult> {
    const response = await this.authorisedFetch(`${this.config.apiBaseUrl}/batches`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        orgId: payload.orgId,
        batchReference: payload.batchReference,
        takingsCents: payload.takingsCents,
        gstCollectedCents: payload.gstCollectedCents,
        cardVolumeCents: payload.cardVolumeCents,
        cashVolumeCents: payload.cashVolumeCents,
        openedAt: payload.openedAt,
        closedAt: payload.closedAt,
        environment: this.config.environment,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new Error(`POS batch upload failed: ${response.status} ${body}`);
    }

    return (await response.json()) as ConnectorSubmissionResult;
  }

  async fetch(options: ConnectorFetchOptions = {}): Promise<PosSettlement[]> {
    const url = new URL(`${this.config.apiBaseUrl}/settlements`);
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
      throw new Error(`Failed to fetch POS settlements: ${response.status} ${body}`);
    }

    return (await response.json()) as PosSettlement[];
  }

  async handleWebhook(message: SignedPayload): Promise<PosSettlement> {
    await this.validateInbound(message);
    return message.payload as PosSettlement;
  }
}

