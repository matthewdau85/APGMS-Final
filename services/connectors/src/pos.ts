import { createSignature, verifySignature } from "./signature.js";
import { retry, type RetryOptions } from "./retry.js";

export interface PosConnectorConfig {
  baseUrl: string;
  webhookSecret: string;
  fetchImpl?: typeof fetch;
  retry?: RetryOptions;
}

export interface PosSaleRecord {
  id: string;
  locationId: string;
  occurredAt: string;
  grossAmountCents: number;
  gstAmountCents: number;
  paymentMethod: string;
}

export interface PosRegisterShift {
  id: string;
  openedAt: string;
  closedAt?: string;
  closingFloatCents: number;
}

export class PosConnectorClient {
  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof fetch;
  private readonly retryOptions: RetryOptions;

  constructor(private readonly config: PosConnectorConfig) {
    this.baseUrl = new URL(config.baseUrl);
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.retryOptions = {
      maxAttempts: 3,
      baseDelayMs: 150,
      ...config.retry,
    };
  }

  async listSales(locationId: string, sinceIso: string): Promise<PosSaleRecord[]> {
    const path = `/locations/${encodeURIComponent(locationId)}/sales?since=${encodeURIComponent(sinceIso)}`;
    return this.request<PosSaleRecord[]>("GET", path);
  }

  async listRegisterShifts(locationId: string, sinceIso: string): Promise<PosRegisterShift[]> {
    const path = `/locations/${encodeURIComponent(locationId)}/register-shifts?since=${encodeURIComponent(sinceIso)}`;
    return this.request<PosRegisterShift[]>("GET", path);
  }

  verifyWebhook(signature: string, timestamp: string, rawBody: string | Buffer): boolean {
    return verifySignature(
      { secret: this.config.webhookSecret, toleranceMs: 2 * 60 * 1000 },
      { payload: rawBody, timestamp },
      signature,
    );
  }

  signPayload(timestamp: string, payload: string | Buffer): string {
    return createSignature({ secret: this.config.webhookSecret }, { payload, timestamp });
  }

  private async request<T>(method: string, path: string, options: { body?: unknown } = {}): Promise<T> {
    const url = new URL(path, this.baseUrl);

    return retry(async () => {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const error = new Error(`POS connector request failed with status ${response.status}`) as Error & { status: number };
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
