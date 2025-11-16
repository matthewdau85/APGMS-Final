import fetch, { RequestInit } from 'node-fetch';

type MigrationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface OnboardingClientOptions {
  baseUrl: string;
  apiKey: string;
  userAgent?: string;
  fetchFn?: typeof fetch;
}

export interface CreateMigrationRequest {
  orgId: string;
  sourceSystem: 'gusto' | 'adp' | 'paychex' | 'square' | 'toast';
  targetLedger: 'netsuite' | 'quickbooks' | 'sage-intacct';
  dryRun?: boolean;
}

export interface MigrationResponse {
  migrationId: string;
  status: MigrationStatus;
  startedAt: string;
}

export class OnboardingClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly userAgent: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: OnboardingClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.userAgent = options.userAgent ?? 'apgms-sdk-typescript/0.1.0';
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async createMigration(body: CreateMigrationRequest): Promise<MigrationResponse> {
    return this.request<MigrationResponse>('/migrations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async registerWebhook(payload: { url: string; events: string[] }): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        'user-agent': this.userAgent,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Request failed (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as T;
  }
}
