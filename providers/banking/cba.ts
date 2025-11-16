import { safeLogAttributes } from "@apgms/shared";

import { BaseBankingProvider } from "./base.js";
import type {
  BankingProviderCapabilities,
  BankingProviderContext,
  CreditDesignatedAccountInput,
} from "./types.js";

type SandboxDependencies = {
  fetchImpl?: typeof fetch;
};

const defaultDependencies: SandboxDependencies = {
  fetchImpl: typeof fetch === "function" ? fetch : undefined,
};

const CAPABILITIES: BankingProviderCapabilities = {
  maxReadTransactions: 1200,
  maxWriteCents: 6_500_000,
};

type SandboxConfig = {
  baseUrl: string;
  token?: string;
};

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

function normalizePath(path: string): string {
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

export class CbaBankingProvider extends BaseBankingProvider {
  private readonly config: SandboxConfig;
  private readonly dependencies: SandboxDependencies;

  constructor(
    config: SandboxConfig = {
      baseUrl:
        process.env.CBA_SANDBOX_URL?.trim() ??
        "https://sandbox.api.commbank.com.au/custody",
      token: process.env.CBA_SANDBOX_TOKEN?.trim(),
    },
    dependencies: SandboxDependencies = defaultDependencies,
  ) {
    super("cba", CAPABILITIES);
    this.config = config;
    this.dependencies = dependencies;
  }

  private async postToSandbox(path: string, payload: Record<string, unknown>) {
    const fetchImpl = this.dependencies.fetchImpl;
    if (!fetchImpl) return;

    const baseUrl = normalizeBaseUrl(this.config.baseUrl);
    const url = `${baseUrl}${normalizePath(path)}`;
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.token
            ? { Authorization: `Bearer ${this.config.token}` }
            : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.warn(
          "banking-provider: sandbox_notification_failed",
          safeLogAttributes({
            providerId: this.id,
            url,
            status: res.status,
          }),
        );
      }
    } catch (error) {
      console.warn(
        "banking-provider: sandbox_notification_failed",
        safeLogAttributes({
          providerId: this.id,
          url,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  override async creditDesignatedAccount(
    context: BankingProviderContext,
    input: CreditDesignatedAccountInput,
  ) {
    await this.postToSandbox("/credits", {
      orgId: context.orgId,
      actorId: context.actorId,
      accountId: input.accountId,
      amount: input.amount,
      source: input.source,
    });

    const result = await super.creditDesignatedAccount(context, input);

    await this.postToSandbox("/reconciliations", {
      transferId: result.transferId,
      orgId: context.orgId,
      accountId: input.accountId,
      amount: input.amount,
    });

    return result;
  }
}
