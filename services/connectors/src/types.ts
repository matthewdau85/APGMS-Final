export interface OAuthClientCredentialsConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  audience?: string;
}

export interface WebhookSecurityConfig {
  secret: string;
  signatureHeader: string;
  timestampHeader?: string;
  toleranceSeconds?: number;
  algorithm?: string;
}

export interface HttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export type HttpTransport = (request: HttpRequest) => Promise<HttpResponse>;
