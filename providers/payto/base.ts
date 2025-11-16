import { randomUUID } from "node:crypto";

import { safeLogAttributes } from "@apgms/shared";
import {
  createSecretManager,
  type SecretManager,
} from "@apgms/shared/security/secret-manager";

import type {
  PayToMandateRequest,
  PayToMandateResult,
  PayToProvider,
  PayToProviderDependencies,
  PayToProviderOptions,
} from "./types.js";

interface PayToCredential {
  apiKey: string;
  clientId?: string;
}

export abstract class BasePayToProvider implements PayToProvider {
  readonly id: string;
  private readonly baseUrl?: string;
  private readonly credentialSecret?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly secretManager: SecretManager;
  private credentials: PayToCredential | null = null;

  protected constructor(
    options: PayToProviderOptions,
    deps: PayToProviderDependencies = {},
  ) {
    this.id = options.id;
    this.baseUrl = options.baseUrl;
    this.credentialSecret = options.credentialSecret;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.fetchImpl = deps.fetch ?? fetch;
    this.secretManager = deps.secretManager ?? createSecretManager();
  }

  abstract initiateMandate(
    request: PayToMandateRequest,
  ): Promise<PayToMandateResult>;

  protected async post<TResponse>(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<TResponse> {
    if (!this.baseUrl) {
      throw new Error(`payto_base_url_missing:${this.id}`);
    }

    const credentials = await this.getCredentials();
    const target = new URL(path, this.baseUrl).toString();

    const response = await this.fetchImpl(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.apiKey}`,
        "X-Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `payto_http_error:${this.id}:${response.status}:${body.slice(0, 120)}`,
      );
    }

    return (await response.json()) as TResponse;
  }

  private async getCredentials(): Promise<PayToCredential> {
    if (this.credentials) {
      return this.credentials;
    }

    const secretId =
      this.credentialSecret ?? `PAYTO_${this.id.toUpperCase()}_CREDENTIALS`;
    const raw = await (this.secretManager as any as {
      getSecret: (name: string) => Promise<string | undefined>;
    }).getSecret(secretId);

    if (!raw || raw.trim().length === 0) {
      throw new Error(`payto_credentials_missing:${this.id}`);
    }

    const trimmed = raw.trim();
    let credential: PayToCredential;
    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed) as {
        apiKey?: string;
        clientId?: string;
      };
      if (!parsed.apiKey) {
        throw new Error(`payto_credentials_missing:${this.id}`);
      }
      credential = { apiKey: parsed.apiKey, clientId: parsed.clientId };
    } else {
      credential = { apiKey: trimmed };
    }

    this.credentials = credential;
    return credential;
  }

  protected logMandateAttempt(payload: PayToMandateRequest): void {
    console.info(
      "payto.mandate.attempt",
      safeLogAttributes({
        provider: this.id,
        orgId: payload.orgId,
        bsb: payload.bsb,
        accountNumber: payload.accountNumber.replace(/\d(?=\d{2})/g, "*"),
        amountCents: payload.amountCents,
      }),
    );
  }
}
