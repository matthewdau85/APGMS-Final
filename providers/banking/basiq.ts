import { AppError } from "@apgms/shared";

import { BaseBankingProvider } from "./base.js";
import type { BankingProviderCapabilities } from "./types.js";

type BasiqAccount = {
  id: string;
  name: string;
  balance: number;
};

type BasiqTransaction = {
  id: string;
  description: string;
  amount: number;
  postedAt: string;
};

type BasiqConfig = {
  baseUrl: string;
  apiKey: string;
};

const CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 1_200,
  maxWriteCents: 3_000_000,
};

function loadConfig(): BasiqConfig {
  return {
    baseUrl: (process.env.BASIQ_API_URL ?? "https://au-api.basiq.io").trim(),
    apiKey: (process.env.BASIQ_API_KEY ?? "").trim(),
  };
}

export class BasiqBankingProvider extends BaseBankingProvider {
  private readonly config: BasiqConfig;

  constructor(config: BasiqConfig = loadConfig()) {
    super("basiq", CAPABILITIES);
    this.config = config;
  }

  private headers(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new AppError(500, "basiq_missing_api_key", "Basiq API key is not configured");
    }
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      Accept: "application/json",
    };
  }

  private async request<T>(path: string): Promise<T> {
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}${path}`, {
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new AppError(
        response.status,
        "basiq_request_failed",
        `Basiq API request failed with status ${response.status}`,
      );
    }
    return (await response.json()) as T;
  }

  async fetchAccounts(orgId: string): Promise<BasiqAccount[]> {
    const payload = await this.request<{
      data?: Array<{ id: string; attributes?: { name?: string; balance?: number } }>;
    }>(`/organisations/${orgId}/accounts`);
    return (payload.data ?? []).map((entry) => ({
      id: entry.id,
      name: entry.attributes?.name ?? "Basiq Account",
      balance: Number(entry.attributes?.balance ?? 0),
    }));
  }

  async fetchRecentTransactions(orgId: string): Promise<BasiqTransaction[]> {
    const payload = await this.request<{
      data?: Array<{
        id: string;
        attributes?: { description?: string; amount?: number; postedAt?: string };
      }>;
    }>(`/organisations/${orgId}/transactions?limit=${this.capabilities.maxReadTransactions}`);

    return (payload.data ?? []).map((entry) => ({
      id: entry.id,
      description: entry.attributes?.description ?? "transaction",
      amount: Number(entry.attributes?.amount ?? 0),
      postedAt: entry.attributes?.postedAt ?? new Date().toISOString(),
    }));
  }
}
