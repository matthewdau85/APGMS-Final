import { EventEmitter } from "node:events";

export type RiskLevel = "low" | "medium" | "high";

export interface RemittanceRequest {
  readonly id: string;
  readonly orgId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly beneficiary: string;
  readonly metadata?: Record<string, unknown>;
}

export interface FraudVerdict {
  readonly risk: RiskLevel;
  readonly reasons: string[];
}

export interface FraudDetector {
  evaluate(request: RemittanceRequest): Promise<FraudVerdict>;
}

export interface ManualReviewItem {
  readonly request: RemittanceRequest;
  readonly reasons: string[];
  readonly receivedAt: Date;
}

export interface RetryTask {
  readonly request: RemittanceRequest;
  readonly attempt: number;
  readonly error: Error;
  readonly scheduledFor: Date;
}

export class ManualReviewQueue {
  private readonly items: ManualReviewItem[] = [];

  enqueue(item: ManualReviewItem): void {
    this.items.push(item);
  }

  drain(): ManualReviewItem[] {
    const snapshot = [...this.items];
    this.items.length = 0;
    return snapshot;
  }

  get size(): number {
    return this.items.length;
  }
}

export class RemittanceRetryQueue extends EventEmitter {
  private readonly tasks: RetryTask[] = [];

  constructor(private readonly maxAttempts = 5) {
    super();
  }

  schedule(task: { request: RemittanceRequest; error: Error; attempt: number }): RetryTask {
    if (task.attempt >= this.maxAttempts) {
      const discarded: RetryTask = {
        request: task.request,
        attempt: task.attempt,
        error: task.error,
        scheduledFor: new Date(),
      };
      this.emit("discarded", discarded);
      return discarded;
    }

    const backoffMs = Math.min(5 * 60 * 1000, 1000 * 2 ** task.attempt);
    const scheduled: RetryTask = {
      request: task.request,
      attempt: task.attempt + 1,
      error: task.error,
      scheduledFor: new Date(Date.now() + backoffMs),
    };
    this.tasks.push(scheduled);
    this.emit("scheduled", scheduled);
    return scheduled;
  }

  drain(): RetryTask[] {
    const snapshot = [...this.tasks];
    this.tasks.length = 0;
    return snapshot;
  }
}

export interface RemittanceOrchestratorOptions {
  readonly primaryDetector: FraudDetector;
  readonly fallbackDetector: FraudDetector;
  readonly manualQueue: ManualReviewQueue;
  readonly retryQueue: RemittanceRetryQueue;
}

export type RemittanceExecutor = (request: RemittanceRequest) => Promise<void>;

export class RemittanceOrchestrator extends EventEmitter {
  constructor(private readonly options: RemittanceOrchestratorOptions) {
    super();
  }

  private emitMetric(metric: string, labels: Record<string, string> = {}): void {
    this.emit("metric", { metric, labels });
  }

  private async detect(request: RemittanceRequest): Promise<FraudVerdict> {
    try {
      const verdict = await this.options.primaryDetector.evaluate(request);
      return verdict;
    } catch (error) {
      this.emitMetric("remittance_detection_fallback_total", {
        orgId: request.orgId,
        reason: (error as Error).message ?? "unknown",
      });
      const fallback = await this.options.fallbackDetector.evaluate(request);
      return fallback;
    }
  }

  async process(request: RemittanceRequest, executor: RemittanceExecutor): Promise<void> {
    const startedAt = Date.now();
    const verdict = await this.detect(request);

    if (verdict.risk === "high") {
      this.options.manualQueue.enqueue({
        request,
        reasons: verdict.reasons,
        receivedAt: new Date(),
      });
      this.emitMetric("remittance_manual_reviews_total", {
        orgId: request.orgId,
      });
      return;
    }

    try {
      await executor(request);
      this.emitMetric("remittance_processed_total", {
        orgId: request.orgId,
        risk: verdict.risk,
      });
    } catch (error) {
      const retry = this.options.retryQueue.schedule({
        request,
        error: error as Error,
        attempt: 0,
      });
      this.emitMetric("remittance_retry_scheduled_total", {
        orgId: request.orgId,
        attempt: String(retry.attempt),
      });
    } finally {
      const latency = Date.now() - startedAt;
      this.emitMetric("remittance_decision_latency_ms", {
        orgId: request.orgId,
        latency: String(latency),
      });
    }
  }
}
