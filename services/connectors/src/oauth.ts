import { Buffer } from "node:buffer";

export interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  audience?: string;
  fetchImpl?: typeof fetch;
  graceWindowSeconds?: number;
}

export interface OAuth2TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

/**
 * Lightweight OAuth2 client credential helper that caches the bearer token
 * and automatically refreshes it when it is close to expiry.  The helper is
 * intentionally dependency free so that it can be reused by the worker, API
 * gateway and background services without pulling an HTTP client framework.
 */
export class OAuth2Client {
  private token?: string;
  private expiresAt = 0;
  private readonly fetchImpl: typeof fetch;
  private inflightPromise?: Promise<string>;
  private readonly graceWindowSeconds: number;

  constructor(private readonly config: OAuth2Config) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.graceWindowSeconds = config.graceWindowSeconds ?? 60;
  }

  async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.expiresAt - this.graceWindowSeconds > now) {
      return this.token;
    }

    if (!this.inflightPromise) {
      this.inflightPromise = this.fetchToken().finally(() => {
        this.inflightPromise = undefined;
      });
    }

    return this.inflightPromise;
  }

  private async fetchToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
    });

    if (this.config.scope) {
      body.set("scope", this.config.scope);
    }

    if (this.config.audience) {
      body.set("audience", this.config.audience);
    }

    const response = await this.fetchImpl(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`, "utf8").toString("base64")}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "<empty>");
      throw new Error(`OAuth2 token request failed with ${response.status}: ${text}`);
    }

    const payload = (await response.json()) as OAuth2TokenResponse;
    if (!payload.access_token || typeof payload.expires_in !== "number") {
      throw new Error("OAuth2 token response missing access_token or expires_in");
    }

    this.token = payload.access_token;
    this.expiresAt = Math.floor(Date.now() / 1000) + payload.expires_in;
    return this.token;
  }
}
