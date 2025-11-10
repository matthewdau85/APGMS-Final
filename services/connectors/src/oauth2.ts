export type OAuth2ClientCredentials = {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  audience?: string;
};

type CachedToken = {
  token: string;
  expiresAt: number;
};

export class OAuth2Client {
  private cache: CachedToken | null = null;

  constructor(private readonly credentials: OAuth2ClientCredentials) {}

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now + 5_000) {
      return this.cache.token;
    }

    const form = new URLSearchParams();
    form.set("grant_type", "client_credentials");
    form.set("client_id", this.credentials.clientId);
    form.set("client_secret", this.credentials.clientSecret);

    if (this.credentials.scopes?.length) {
      form.set("scope", this.credentials.scopes.join(" "));
    }

    if (this.credentials.audience) {
      form.set("audience", this.credentials.audience);
    }

    const response = await fetch(this.credentials.tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OAuth2 token request failed with ${response.status}: ${body}`);
    }

    const payload = (await response.json()) as {
      access_token: string;
      expires_in?: number;
      token_type?: string;
    };

    const expiresIn = Math.max(60, payload.expires_in ?? 3600);
    const tokenType = payload.token_type ?? "Bearer";
    const token = `${tokenType} ${payload.access_token}`;

    this.cache = {
      token,
      expiresAt: now + expiresIn * 1000,
    };

    return token;
  }
}
