import { AppError } from "../../shared/src/errors.js";
import { safeLogAttributes } from "../../shared/src/logging.js";

export type CbaBankingApiClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type CreateCreditPayload = {
  orgId: string;
  actorId: string;
  accountId: string;
  amount: number;
  reference: string;
};

export class CbaBankingApiClient {
  private readonly baseUrl: URL;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CbaBankingApiClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async createCredit(payload: CreateCreditPayload): Promise<void> {
    const endpoint = new URL(
      `/orgs/${encodeURIComponent(payload.orgId)}/accounts/${encodeURIComponent(payload.accountId)}/credits`,
      this.baseUrl,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          amount: payload.amount,
          reference: payload.reference,
          actorId: payload.actorId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AppError(
          response.status >= 500 ? 502 : response.status,
          "banking_api_error",
          body || response.statusText,
        );
      }

      console.info(
        "banking-provider:cba api", 
        safeLogAttributes({
          path: endpoint.pathname,
          status: response.status,
        }),
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AppError(504, "banking_api_timeout", "Banking API request timed out");
      }
      throw new AppError(
        502,
        "banking_api_request_failed",
        `Failed to reach banking API: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
