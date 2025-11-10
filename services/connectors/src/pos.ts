import { HttpClient } from "./http.js";
import { OAuth2Client, type OAuth2ClientCredentials } from "./oauth2.js";
import { verifyWebhookSignature } from "./webhooks.js";

export type PosConnectorOptions = {
  apiBaseUrl: string;
  oauth: OAuth2ClientCredentials;
  webhookSecret: string;
};

export type PosSaleEvent = {
  id: string;
  locationId: string;
  grossAmountCents: number;
  gstAmountCents: number;
  occurredAt: string;
  registerReference?: string;
};

export class PosConnector {
  private readonly http: HttpClient;
  private readonly oauth: OAuth2Client;

  constructor(private readonly options: PosConnectorOptions) {
    this.http = new HttpClient({ baseUrl: options.apiBaseUrl });
    this.oauth = new OAuth2Client(options.oauth);
  }

  private async withAuth<T>(handler: (token: string) => Promise<T>): Promise<T> {
    const token = await this.oauth.getAccessToken();
    return handler(token);
  }

  verifyWebhook(payload: string, headers: Record<string, string | string[] | undefined>): boolean {
    return verifyWebhookSignature(payload, headers, {
      secret: this.options.webhookSecret,
      headerName: "x-pos-signature",
      algorithm: "sha512",
    });
  }

  async acknowledgeSale(eventId: string): Promise<void> {
    await this.withAuth(async (token) => {
      await this.http.request({
        method: "POST",
        url: "/v1/sales/ack",
        headers: { Authorization: token },
        body: { eventId },
      });
    });
  }

  async listRecentSales(sinceIsoTimestamp: string): Promise<PosSaleEvent[]> {
    return this.withAuth(async (token) => {
      const response = await this.http.request<{ sales: PosSaleEvent[] }>({
        method: "GET",
        url: `/v1/sales?since=${encodeURIComponent(sinceIsoTimestamp)}`,
        headers: { Authorization: token },
        retry: { attempts: 3, backoffMs: 400 },
      });

      return response.body.sales;
    });
  }
}
