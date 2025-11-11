import {
  SecureConnectorAdapter,
  type ConnectorAdapterOptions,
  type ConnectorWebhookEnvelope,
} from "./base.js";

export interface PosBatchPayload {
  eventType: "batch.closed";
  locationId: string;
  batchId: string;
  grossAmount: number;
  gstAmount: number;
  closedAt: string;
}

export interface PosChargebackPayload {
  eventType: "chargeback.created";
  locationId: string;
  paymentId: string;
  amount: number;
  occurredAt: string;
}

export type PosWebhookPayload =
  | PosBatchPayload
  | PosChargebackPayload
  | ({ eventType: string } & Record<string, unknown>);

export interface PosConnectorOptions extends ConnectorAdapterOptions {
  onBatchClosed?: (payload: PosBatchPayload) => Promise<void>;
  onChargeback?: (payload: PosChargebackPayload) => Promise<void>;
}

export class PosConnector extends SecureConnectorAdapter<PosWebhookPayload> {
  constructor(private readonly posOptions: PosConnectorOptions) {
    super(posOptions);
  }

  public async syncRegister(locationId: string, sinceIso: string): Promise<unknown> {
    const response = await this.authenticatedRequest({
      path: `/locations/${encodeURIComponent(locationId)}/sales?since=${encodeURIComponent(sinceIso)}`,
      retryAttempts: 2,
    });

    if (response.status >= 400) {
      throw new Error(`pos_sync_failed:${response.status}`);
    }

    return JSON.parse(response.body) as unknown;
  }

  protected async onWebhook(
    envelope: ConnectorWebhookEnvelope<PosWebhookPayload>,
  ): Promise<void> {
    const payload = envelope.parsedBody;
    if (!payload || typeof payload !== "object") {
      throw new Error("pos_webhook_unparseable");
    }

    switch (payload.eventType) {
      case "batch.closed": {
        if (this.posOptions.onBatchClosed) {
          await this.posOptions.onBatchClosed(payload as PosBatchPayload);
        }
        break;
      }
      case "chargeback.created": {
        if (this.posOptions.onChargeback) {
          await this.posOptions.onChargeback(payload as PosChargebackPayload);
        }
        break;
      }
      default:
        break;
    }
  }
}
