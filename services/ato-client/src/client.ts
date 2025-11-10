import { setTimeout as delay } from "node:timers/promises";

import type {
  AtoClientConfig,
  BasDetails,
  LodgmentPayload,
  LodgmentResponse,
  LodgmentStatusRecord,
  ManualFallbackTrigger,
  StpDetails,
} from "./types.js";

const DEFAULT_TIMEOUT = 30_000;

type RequestBody = Record<string, unknown> | undefined;

export class AtoSubmissionClient {
  private readonly config: Required<AtoClientConfig>;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AtoClientConfig, fetchImpl: typeof fetch = fetch) {
    this.config = {
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT,
      ...config,
    };
    this.fetchImpl = fetchImpl;
  }

  async submitStp(payload: LodgmentPayload<StpDetails>): Promise<LodgmentResponse> {
    return this.post(`/lodgments/stp`, payload);
  }

  async submitBas(payload: LodgmentPayload<BasDetails>): Promise<LodgmentResponse> {
    return this.post(`/lodgments/bas`, payload);
  }

  async getStatus(lodgmentId: string): Promise<LodgmentStatusRecord> {
    const response = await this.request("GET", `/lodgments/${lodgmentId}`);
    return (await response.json()) as LodgmentStatusRecord;
  }

  async acknowledgeManualFallback(trigger: ManualFallbackTrigger): Promise<void> {
    await this.post(`/lodgments/${trigger.lodgmentId}/manual-fallback`, trigger);
  }

  async waitForAcceptance(lodgmentId: string, pollIntervalMs = 10_000): Promise<LodgmentStatusRecord> {
    for (;;) {
      const status = await this.getStatus(lodgmentId);
      if (status.status === "ACCEPTED" || status.status === "REJECTED") {
        return status;
      }

      await delay(pollIntervalMs);
    }
  }

  private async post(path: string, body: RequestBody): Promise<LodgmentResponse> {
    const response = await this.request("POST", path, body ? JSON.stringify(body) : undefined);
    return (await response.json()) as LodgmentResponse;
  }

  private async request(method: string, path: string, body?: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.config.apiBaseUrl}${path}`, {
        method,
        body,
        headers: {
          "content-type": "application/json",
          "x-ato-tenant": this.config.tenantId,
          "x-api-key": this.config.apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new Error(`ATO client request failed: ${response.status} ${message}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface QueueItem {
  lodgmentId: string;
  type: "STP" | "BAS";
  payload: RequestBody;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

export class LodgmentQueue {
  private readonly items = new Map<string, QueueItem>();
  private readonly maxAttempts: number;
  private readonly backoffSeconds: number;

  constructor(maxAttempts = 5, backoffSeconds = 60) {
    this.maxAttempts = maxAttempts;
    this.backoffSeconds = backoffSeconds;
  }

  enqueue(item: QueueItem): void {
    if (!this.items.has(item.lodgmentId)) {
      this.items.set(item.lodgmentId, item);
    }
  }

  markFailure(lodgmentId: string, error: Error): QueueItem | undefined {
    const item = this.items.get(lodgmentId);
    if (!item) {
      return undefined;
    }

    item.attempts += 1;
    item.lastError = error.message;

    if (item.attempts >= this.maxAttempts) {
      this.items.delete(lodgmentId);
      return { ...item, nextAttemptAt: Number.POSITIVE_INFINITY };
    }

    const delaySeconds = this.backoffSeconds * Math.pow(2, item.attempts - 1);
    item.nextAttemptAt = Date.now() + delaySeconds * 1000;
    return item;
  }

  markSuccess(lodgmentId: string): void {
    this.items.delete(lodgmentId);
  }

  drainReady(now: number = Date.now()): QueueItem[] {
    const ready: QueueItem[] = [];
    for (const item of this.items.values()) {
      if (item.nextAttemptAt <= now) {
        ready.push(item);
      }
    }
    return ready.sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);
  }
}

export interface QueueProcessorOptions {
  onManualFallback: (trigger: ManualFallbackTrigger) => Promise<void> | void;
  pollIntervalMs?: number;
}

export class QueueProcessor {
  private readonly client: AtoSubmissionClient;
  private readonly queue: LodgmentQueue;
  private readonly options: Required<QueueProcessorOptions>;

  constructor(
    client: AtoSubmissionClient,
    queue: LodgmentQueue,
    options: QueueProcessorOptions,
  ) {
    this.client = client;
    this.queue = queue;
    this.options = {
      pollIntervalMs: options.pollIntervalMs ?? 15_000,
      onManualFallback: options.onManualFallback,
    };
  }

  async start(signal?: AbortSignal): Promise<void> {
    while (!signal?.aborted) {
      const readyItems = this.queue.drainReady();
      for (const item of readyItems) {
        try {
          let response: LodgmentResponse;
          if (item.type === "STP") {
            response = await this.client.submitStp(item.payload as LodgmentPayload<StpDetails>);
          } else {
            response = await this.client.submitBas(item.payload as LodgmentPayload<BasDetails>);
          }

          if (response.status === "AWAITING_MANUAL_REVIEW") {
            await this.options.onManualFallback({
              lodgmentId: response.lodgmentId,
              reason: response.message ?? "ATO requested manual review",
              triggeredAt: new Date().toISOString(),
            });
            this.queue.markSuccess(item.lodgmentId);
            continue;
          }

          if (response.status === "REJECTED") {
            throw new Error(response.message ?? "ATO rejected lodgment");
          }

          this.queue.markSuccess(item.lodgmentId);
        } catch (error) {
          const failure = this.queue.markFailure(item.lodgmentId, error as Error);
          if (failure && failure.nextAttemptAt === Number.POSITIVE_INFINITY) {
            await this.options.onManualFallback({
              lodgmentId: failure.lodgmentId,
              reason: failure.lastError ?? "Exceeded retry attempts",
              triggeredAt: new Date().toISOString(),
            });
          }
        }
      }

      await delay(this.options.pollIntervalMs);
    }
  }
}

