import { HttpClient, HttpError } from "./http.js";
import { OAuth2Client, type OAuth2ClientCredentials } from "./oauth2.js";
import { verifyWebhookSignature } from "./webhooks.js";

export type BankingConnectorOptions = {
  apiBaseUrl: string;
  oauth: OAuth2ClientCredentials;
  webhookSecret: string;
};

export type ExternalBankAccount = {
  id: string;
  name: string;
  institution: string;
  currency: string;
  last4: string;
  depositOnly: boolean;
};

export type ExternalBankTransaction = {
  id: string;
  accountId: string;
  amountCents: number;
  description: string;
  postedAt: string;
  type: "credit" | "debit";
  metadata?: Record<string, unknown>;
};

export class BankingConnector {
  private readonly http: HttpClient;
  private readonly oauth: OAuth2Client;

  constructor(private readonly options: BankingConnectorOptions) {
    this.http = new HttpClient({ baseUrl: options.apiBaseUrl });
    this.oauth = new OAuth2Client(options.oauth);
  }

  private async withAuth<T>(handler: (token: string) => Promise<T>): Promise<T> {
    const token = await this.oauth.getAccessToken();
    return handler(token);
  }

  async listAccounts(): Promise<ExternalBankAccount[]> {
    return this.withAuth(async (token) => {
      const response = await this.http.request<{ accounts: ExternalBankAccount[] }>({
        method: "GET",
        url: "/v1/accounts",
        headers: { Authorization: token },
        retry: { attempts: 3, backoffMs: 200 },
      });

      return response.body.accounts.map((account) => ({
        ...account,
        depositOnly: account.depositOnly ?? false,
      }));
    });
  }

  async syncTransactions(
    accountId: string,
    sinceIsoTimestamp?: string,
  ): Promise<ExternalBankTransaction[]> {
    return this.withAuth(async (token) => {
      const url = new URL("/v1/accounts/" + encodeURIComponent(accountId) + "/transactions", this.options.apiBaseUrl);
      if (sinceIsoTimestamp) {
        url.searchParams.set("since", sinceIsoTimestamp);
      }

      const response = await this.http.request<{ transactions: ExternalBankTransaction[] }>({
        method: "GET",
        url: url.toString(),
        headers: { Authorization: token },
        retry: { attempts: 3, backoffMs: 300 },
      });

      return response.body.transactions;
    });
  }

  async acknowledgeWebhook(eventId: string): Promise<void> {
    await this.withAuth(async (token) => {
      await this.http.request({
        method: "POST",
        url: "/v1/webhooks/ack",
        headers: { Authorization: token },
        body: { eventId },
      });
    });
  }

  verifyWebhook(payload: string, headers: Record<string, string | string[] | undefined>): boolean {
    return verifyWebhookSignature(payload, headers, {
      secret: this.options.webhookSecret,
      headerName: "x-bank-signature",
    });
  }

  async initiateDeposit(accountId: string, amountCents: number, reference: string): Promise<void> {
    if (amountCents <= 0) {
      throw new HttpError("Deposits must be positive", { method: "POST", url: "/v1/deposits" }, 400, {});
    }

    await this.withAuth(async (token) => {
      await this.http.request({
        method: "POST",
        url: "/v1/deposits",
        headers: { Authorization: token },
        body: {
          accountId,
          amountCents,
          reference,
        },
      });
    });
  }
}
