export type OAuthConfig = {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
};

type TokenState = {
  token: string;
  expiresAt: number;
};

export class OAuthSession {
  private cache: TokenState | null = null;

  constructor(private readonly config: OAuthConfig) {}

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt - 5_000 > now) {
      return this.cache.token;
    }

    const form = new URLSearchParams();
    form.set("grant_type", "client_credentials");
    form.set("client_id", this.config.clientId);
    form.set("client_secret", this.config.clientSecret);
    if (this.config.scopes?.length) {
      form.set("scope", this.config.scopes.join(" "));
    }

    const response = await fetch(this.config.tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to acquire OAuth token: ${response.status} ${error}`);
    }

    const body = (await response.json()) as {
      access_token: string;
      token_type?: string;
      expires_in?: number;
    };

    const tokenType = body.token_type ?? "Bearer";
    const expiresIn = Math.max(60, body.expires_in ?? 3600);
    const token = `${tokenType} ${body.access_token}`;

    this.cache = {
      token,
      expiresAt: now + expiresIn * 1000,
    };

    return token;
  }
}
