import { HttpClient } from "./http.js";
import { OAuth2Client, type OAuth2ClientCredentials } from "./oauth2.js";

export type PayrollConnectorOptions = {
  apiBaseUrl: string;
  oauth: OAuth2ClientCredentials;
};

export type PayrollEmployeePayload = {
  id: string;
  taxFileNumberHash: string;
  grossPayCents: number;
  paygWithheldCents: number;
  superCents: number;
};

export type PayRunSubmission = {
  id: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  employees: PayrollEmployeePayload[];
};

export class PayrollConnector {
  private readonly http: HttpClient;
  private readonly oauth: OAuth2Client;

  constructor(options: PayrollConnectorOptions) {
    this.http = new HttpClient({ baseUrl: options.apiBaseUrl });
    this.oauth = new OAuth2Client(options.oauth);
  }

  private async withAuth<T>(handler: (token: string) => Promise<T>): Promise<T> {
    const token = await this.oauth.getAccessToken();
    return handler(token);
  }

  async submitSingleTouchPayroll(payload: PayRunSubmission): Promise<{ lodgementId: string }> {
    return this.withAuth(async (token) => {
      const response = await this.http.request<{ lodgementId: string }>({
        method: "POST",
        url: "/v1/stp",
        headers: { Authorization: token },
        body: payload,
        retry: { attempts: 2, backoffMs: 500 },
      });

      return response.body;
    });
  }

  async notifyPayEventAccepted(lodgementId: string): Promise<void> {
    await this.withAuth(async (token) => {
      await this.http.request({
        method: "POST",
        url: "/v1/stp/ack",
        headers: { Authorization: token },
        body: { lodgementId },
      });
    });
  }
}
