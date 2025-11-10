import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  AtoSubmissionClient,
  LodgmentQueue,
  QueueProcessor,
  type LodgmentPayload,
  type BasDetails,
  type StpDetails,
  type ManualFallbackTrigger,
} from "../../services/ato-client/src/index.js";

interface LodgmentRecord {
  lodgmentId: string;
  type: "STP" | "BAS";
  payload: LodgmentPayload<StpDetails | BasDetails>;
  status: "QUEUED" | "SUBMITTED" | "FAILED" | "MANUAL";
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

export interface SchedulerDependencies {
  fetchQueuedLodgments(): Promise<LodgmentRecord[]>;
  persistStatus(update: Partial<LodgmentRecord> & { lodgmentId: string }): Promise<void>;
  recordManualFallback(trigger: ManualFallbackTrigger): Promise<void>;
  client: AtoSubmissionClient;
  queue?: LodgmentQueue;
}

export class AtoLodgmentScheduler {
  private readonly deps: SchedulerDependencies;
  private readonly queue: LodgmentQueue;
  private readonly processor: QueueProcessor;

  constructor(deps: SchedulerDependencies) {
    this.deps = deps;
    this.queue = deps.queue ?? new LodgmentQueue();
    this.processor = new QueueProcessor(deps.client, this.queue, {
      onManualFallback: async (trigger) => {
        await this.deps.recordManualFallback(trigger);
        await this.deps.persistStatus({ lodgmentId: trigger.lodgmentId, status: "MANUAL" });
      },
    });
  }

  async primeQueue(): Promise<void> {
    const lodgments = await this.deps.fetchQueuedLodgments();
    for (const record of lodgments) {
      this.queue.enqueue({
        lodgmentId: record.lodgmentId,
        type: record.type,
        payload: record.payload,
        attempts: record.attempts,
        nextAttemptAt: record.nextAttemptAt,
        lastError: record.lastError,
      });
    }
  }

  async start(signal?: AbortSignal): Promise<void> {
    await this.primeQueue();
    await this.processor.start(signal);
  }

  async recordFailure(lodgmentId: string, error: Error): Promise<void> {
    await this.deps.persistStatus({
      lodgmentId,
      status: "FAILED",
      lastError: error.message,
      nextAttemptAt: Date.now(),
    });
  }

  async recordSubmission(lodgmentId: string): Promise<void> {
    await this.deps.persistStatus({ lodgmentId, status: "SUBMITTED" });
  }
}

function createDefaultClient(): AtoSubmissionClient {
  const apiBaseUrl = process.env.ATO_API_BASE_URL ?? "https://sandbox.ato.gov.au";
  const tenantId = process.env.ATO_TENANT_ID ?? "sandbox";
  const apiKey = process.env.ATO_API_KEY ?? "development";

  return new AtoSubmissionClient({ apiBaseUrl, tenantId, apiKey });
}

async function defaultFetchQueuedLodgments(): Promise<LodgmentRecord[]> {
  return [];
}

async function defaultPersistStatus(): Promise<void> {
  // In production this would persist to Postgres via Prisma; here it is a no-op stub.
}

async function defaultManualFallback(trigger: ManualFallbackTrigger): Promise<void> {
  process.stderr.write(
    `Manual fallback required for ${trigger.lodgmentId}: ${trigger.reason} (triggered ${trigger.triggeredAt})\n`,
  );
}

export function createDefaultScheduler(): AtoLodgmentScheduler {
  return new AtoLodgmentScheduler({
    client: createDefaultClient(),
    fetchQueuedLodgments: defaultFetchQueuedLodgments,
    persistStatus: defaultPersistStatus,
    recordManualFallback: defaultManualFallback,
  });
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  const scheduler = createDefaultScheduler();
  scheduler
    .start()
    .then(() => {
      process.stdout.write("ATO lodgment scheduler exited cleanly\n");
    })
    .catch((error) => {
      console.error("ATO lodgment scheduler failed", error);
      process.exitCode = 1;
    });
}

