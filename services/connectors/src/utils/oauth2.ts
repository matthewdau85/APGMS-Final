import { setTimeout as delay } from "node:timers/promises";

import type { OAuthClientConfig, OAuthTokenResponse } from "../types.js";

export class OAuth2TokenManager {
  private currentToken: OAuthTokenResponse | null = null;
  private readonly config: OAuthClientConfig;
  private readonly clock: () => number;

  constructor(config: OAuthClientConfig, clock: () => number = () => Date.now()) {
    this.config = config;
    this.clock = clock;
  }

  async getAccessToken(): Promise<string> {
    if (this.currentToken && !this.isExpired(this.currentToken)) {
      return this.currentToken.access_token;
    }

    this.currentToken = await this.requestToken();
    return this.currentToken.access_token;
  }

  private isExpired(token: OAuthTokenResponse): boolean {
    const expiresAt = token.received_at + (token.expires_in - 30) * 1000;
    return this.clock() >= expiresAt;
  }

  private async requestToken(): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    if (this.config.scope) {
      body.set("scope", this.config.scope);
    }

    if (this.config.audience) {
      body.set("audience", this.config.audience);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`OAuth2 token request failed: ${response.status} ${message}`);
    }

    const json = (await response.json()) as Omit<OAuthTokenResponse, "received_at">;

    const token: OAuthTokenResponse = {
      ...json,
      received_at: this.clock(),
    };

    return token;
  }

  async waitForRefresh(retryMs = 500): Promise<void> {
    if (!this.currentToken) {
      return;
    }

    const refreshIn = Math.max(this.currentToken.expires_in - 60, 1) * 1000;
    await delay(refreshIn + Math.random() * retryMs);
    await this.requestToken();
  }
}

