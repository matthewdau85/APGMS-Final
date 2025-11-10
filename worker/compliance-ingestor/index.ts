import { randomUUID } from "node:crypto";

import { PrismaClient, Prisma } from "@prisma/client";
import {
  DiscardPolicy,
  RetentionPolicy,
  StorageType,
  StringCodec,
  connect,
  consumerOpts,
  type JetStreamClient,
  type JetStreamManager,
  type JetStreamSubscription,
  type NatsConnection,
} from "nats";

const codec = StringCodec();

export interface ComplianceIngestorOptions {
  natsUrl?: string;
  stream?: string;
  subjectPrefix?: string;
  durablePrefix?: string;
  connectionName?: string;
}

export interface ComplianceIngestorRuntime {
  stop: () => Promise<void>;
}

type DomainEventEnvelope<T = unknown> = {
  id: string;
  orgId: string;
  eventType: string;
  key: string;
  ts: string;
  schemaVersion: string;
  source: string;
  dedupeId: string;
  traceId?: string;
  payload: T;
};

type LedgerDiscrepancyPayload = {
  discrepancyId: string;
  source: string;
  category: string;
  severity: string;
  summary: string;
  status?: string;
  detectedAt?: string;
  amountCents?: number | null;
  details?: unknown;
};

type FraudAlertPayload = {
  fraudAlertId: string;
  discrepancyId?: string | null;
  alertCode: string;
  severity: string;
  summary: string;
  metadata?: unknown;
};

type RemediationPayload = {
  remediationId: string;
  discrepancyId?: string | null;
  fraudAlertId?: string | null;
  actionType: string;
  status?: string;
  assignedTo?: string | null;
  dueAt?: string | null;
  notes?: string | null;
  metadata?: unknown;
};

type PaymentPlanPayload = {
  paymentPlanId: string;
  discrepancyId?: string | null;
  fraudAlertId?: string | null;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  paymentFrequency: string;
  totalAmountCents?: number | null;
  terms?: unknown;
};

function resolveOption(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

async function ensureStream(manager: JetStreamManager, stream: string, prefix: string): Promise<void> {
  try {
    await manager.streams.info(stream);
    return;
  } catch {
    // fall through
  }

  await manager.streams.add({
    name: stream,
    subjects: [`${prefix}.>`],
    retention: RetentionPolicy.Limits,
    discard: DiscardPolicy.Old,
    storage: StorageType.File,
    num_replicas: 1,
  });
}

function decodeEnvelope(data: Uint8Array): DomainEventEnvelope {
  const raw = codec.decode(data);
  return JSON.parse(raw) as DomainEventEnvelope;
}

async function persistEnvelope(prisma: PrismaClient, envelope: DomainEventEnvelope): Promise<void> {
  const ts = new Date(envelope.ts);
  await prisma.eventEnvelope.upsert({
    where: { id: envelope.id },
    update: {
      orgId: envelope.orgId,
      eventType: envelope.eventType,
      key: envelope.key,
      ts,
      schemaVersion: envelope.schemaVersion,
      source: envelope.source,
      traceId: envelope.traceId ?? null,
      payload: envelope.payload as Prisma.JsonValue,
      processedAt: new Date(),
      status: "processed",
      error: null,
    },
    create: {
      id: envelope.id,
      orgId: envelope.orgId,
      eventType: envelope.eventType,
      key: envelope.key,
      ts,
      schemaVersion: envelope.schemaVersion,
      source: envelope.source,
      traceId: envelope.traceId ?? null,
      payload: envelope.payload as Prisma.JsonValue,
      processedAt: new Date(),
      status: "processed",
    },
  });
}

function toBigInt(value: number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  return BigInt(Math.trunc(value));
}

async function upsertDiscrepancy(
  prisma: PrismaClient,
  envelope: DomainEventEnvelope<LedgerDiscrepancyPayload>,
): Promise<void> {
  const payload = envelope.payload;
  const detectedAt = payload.detectedAt ? new Date(payload.detectedAt) : new Date(envelope.ts);
  const amount = toBigInt(payload.amountCents ?? null);
  await prisma.discrepancy.upsert({
    where: { id: payload.discrepancyId },
    update: {
      source: payload.source,
      category: payload.category,
      severity: payload.severity,
      status: payload.status ?? "open",
      summary: payload.summary,
      detectedAt,
      amountCents: amount,
      details: (payload.details as Prisma.JsonValue | undefined) ?? Prisma.JsonNull,
      resolvedAt: (payload.status ?? "open").toLowerCase() === "closed" ? new Date(envelope.ts) : undefined,
    },
    create: {
      id: payload.discrepancyId,
      orgId: envelope.orgId,
      source: payload.source,
      category: payload.category,
      severity: payload.severity,
      status: payload.status ?? "open",
      summary: payload.summary,
      detectedAt,
      amountCents: amount,
      details: (payload.details as Prisma.JsonValue | undefined) ?? Prisma.JsonNull,
    },
  });
}

async function upsertFraudAlert(
  prisma: PrismaClient,
  envelope: DomainEventEnvelope<FraudAlertPayload>,
): Promise<void> {
  const payload = envelope.payload;
  await prisma.fraudAlert.upsert({
    where: { id: payload.fraudAlertId },
    update: {
      discrepancyId: payload.discrepancyId ?? null,
      severity: payload.severity,
      summary: payload.summary,
      metadata: (payload.metadata as Prisma.JsonValue | undefined) ?? Prisma.JsonNull,
      status: "OPEN",
    },
    create: {
      id: payload.fraudAlertId,
      orgId: envelope.orgId,
      discrepancyId: payload.discrepancyId ?? null,
      alertCode: payload.alertCode,
      status: "OPEN",
      severity: payload.severity,
      summary: payload.summary,
      metadata: (payload.metadata as Prisma.JsonValue | undefined) ?? Prisma.JsonNull,
    },
  });
}

async function upsertRemediation(
  prisma: PrismaClient,
  envelope: DomainEventEnvelope<RemediationPayload>,
): Promise<void> {
  const payload = envelope.payload;
  const dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
  const status = payload.status ?? "pending";
  await prisma.remediationAction.upsert({
    where: { id: payload.remediationId },
    update: {
      discrepancyId: payload.discrepancyId ?? null,
      fraudAlertId: payload.fraudAlertId ?? null,
      actionType: payload.actionType,
      status,
      assignedTo: payload.assignedTo ?? null,
      dueAt,
      notes: payload.notes ?? null,
      metadata: (payload.metadata as Prisma.JsonValue | undefined) ?? Prisma.JsonNull,
      completedAt: status.toLowerCase() === "completed" ? new Date(envelope.ts) : undefined,
    },
    create: {
      id: payload.remediationId,
      orgId: envelope.orgId,
      discrepancyId: payload.discrepancyId ?? null,
      fraudAlertId: payload.fraudAlertId ?? null,
      actionType: payload.actionType,
      status,
      assignedTo: payload.assignedTo ?? null,
      dueAt,
      notes: payload.notes ?? null,
      metadata: (payload.metadata as Prisma.JsonValue | undefined) ?? Prisma.JsonNull,
      completedAt: status.toLowerCase() === "completed" ? new Date(envelope.ts) : null,
    },
  });
}

async function upsertPaymentPlan(
  prisma: PrismaClient,
  envelope: DomainEventEnvelope<PaymentPlanPayload>,
): Promise<void> {
  const payload = envelope.payload;
  const startDate = payload.startDate ? new Date(payload.startDate) : null;
  const endDate = payload.endDate ? new Date(payload.endDate) : null;
  const amount = toBigInt(payload.totalAmountCents ?? null);
  await prisma.paymentPlanAgreement.upsert({
    where: { id: payload.paymentPlanId },
    update: {
      discrepancyId: payload.discrepancyId ?? null,
      fraudAlertId: payload.fraudAlertId ?? null,
      status: payload.status ?? "draft",
      startDate,
      endDate,
      paymentFrequency: payload.paymentFrequency,
      totalAmountCents: amount,
      terms: (payload.terms as Prisma.JsonValue | undefined) ?? Prisma.JsonNull,
    },
    create: {
      id: payload.paymentPlanId,
      orgId: envelope.orgId,
      discrepancyId: payload.discrepancyId ?? null,
      fraudAlertId: payload.fraudAlertId ?? null,
      status: payload.status ?? "draft",
      startDate,
      endDate,
      paymentFrequency: payload.paymentFrequency,
      totalAmountCents: amount,
      terms: (payload.terms as Prisma.JsonValue | undefined) ?? Prisma.JsonNull,
    },
  });
}

async function computeBaselineKpis(prisma: PrismaClient, orgId: string): Promise<void> {
  const [openDiscrepancies, openFraudAlerts, activeRemediations, activePlans] = await Promise.all([
    prisma.discrepancy.count({
      where: {
        orgId,
        status: {
          in: ["open", "investigating", "pending", "review"],
        },
      },
    }),
    prisma.fraudAlert.count({
      where: {
        orgId,
        status: {
          in: ["OPEN"],
        },
      },
    }),
    prisma.remediationAction.count({
      where: {
        orgId,
        status: {
          in: ["pending", "in_progress"],
        },
      },
    }),
    prisma.paymentPlanAgreement.count({
      where: {
        orgId,
        status: {
          in: ["draft", "active"],
        },
      },
    }),
  ]);

  const payload = {
    openDiscrepancies,
    openFraudAlerts,
    activeRemediations,
    activePlans,
    generatedAt: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  await prisma.eventEnvelope.upsert({
    where: { id: `baseline-${orgId}` },
    update: {
      key: `baseline:${orgId}`,
      ts: new Date(),
      schemaVersion: "2025-03-12",
      source: "worker.compliance-ingestor",
      payload,
      processedAt: new Date(),
      status: "processed",
      error: null,
    },
    create: {
      id: `baseline-${orgId}`,
      orgId,
      eventType: "compliance.baseline.kpi",
      key: `baseline:${orgId}`,
      ts: new Date(),
      schemaVersion: "2025-03-12",
      source: "worker.compliance-ingestor",
      payload,
      processedAt: new Date(),
      status: "processed",
    },
  });
}

async function updateTrainingDataset(prisma: PrismaClient, orgId: string): Promise<void> {
  const samples = await prisma.remediationAction.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      discrepancy: {
        select: {
          severity: true,
          category: true,
          amountCents: true,
        },
      },
      fraudAlert: {
        select: {
          severity: true,
        },
      },
    },
  });

  const dataset = samples.map((sample) => ({
    remediationId: sample.id,
    actionType: sample.actionType,
    status: sample.status,
    assignedTo: sample.assignedTo,
    dueAt: sample.dueAt ? sample.dueAt.toISOString() : null,
    completedAt: sample.completedAt ? sample.completedAt.toISOString() : null,
    discrepancySeverity: sample.discrepancy?.severity ?? null,
    discrepancyCategory: sample.discrepancy?.category ?? null,
    discrepancyAmountCents: sample.discrepancy?.amountCents != null
      ? Number(sample.discrepancy.amountCents)
      : null,
    fraudAlertSeverity: sample.fraudAlert?.severity ?? null,
  }));

  const payload = {
    samples: dataset,
    refreshedAt: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  await prisma.eventEnvelope.upsert({
    where: { id: `training-${orgId}` },
    update: {
      key: `training:${orgId}`,
      ts: new Date(),
      schemaVersion: "2025-03-12",
      source: "worker.compliance-ingestor",
      payload,
      processedAt: new Date(),
      status: "processed",
      error: null,
    },
    create: {
      id: `training-${orgId}`,
      orgId,
      eventType: "compliance.training.dataset",
      key: `training:${orgId}`,
      ts: new Date(),
      schemaVersion: "2025-03-12",
      source: "worker.compliance-ingestor",
      payload,
      processedAt: new Date(),
      status: "processed",
    },
  });
}

async function routeEvent(prisma: PrismaClient, envelope: DomainEventEnvelope): Promise<void> {
  switch (envelope.eventType) {
    case "ledger.discrepancy.recorded":
      await upsertDiscrepancy(prisma, envelope as DomainEventEnvelope<LedgerDiscrepancyPayload>);
      break;
    case "compliance.fraud-alert.raised":
      await upsertFraudAlert(prisma, envelope as DomainEventEnvelope<FraudAlertPayload>);
      break;
    case "compliance.remediation.action-tracked":
      await upsertRemediation(prisma, envelope as DomainEventEnvelope<RemediationPayload>);
      break;
    case "payments.plan.agreement-created":
      await upsertPaymentPlan(prisma, envelope as DomainEventEnvelope<PaymentPlanPayload>);
      break;
    default:
      return;
  }

  await computeBaselineKpis(prisma, envelope.orgId);
  await updateTrainingDataset(prisma, envelope.orgId);
}

async function subscribe(
  jetstream: JetStreamClient,
  subject: string,
  durableName: string,
  handler: (envelope: DomainEventEnvelope) => Promise<void>,
): Promise<JetStreamSubscription> {
  const opts = consumerOpts();
  opts.durable(durableName);
  opts.manualAck();
  opts.ackExplicit();
  opts.deliverGroup(durableName);
  opts.queue(durableName);
  opts.deliverTo(`${durableName}-${randomUUID().slice(0, 8)}`);

  const subscription = await jetstream.subscribe(subject, opts);

  (async () => {
    for await (const message of subscription) {
      try {
        const envelope = decodeEnvelope(message.data);
        await handler(envelope);
        message.ack();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to process compliance event", { subject, error });
        message.nak();
      }
    }
  })().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Compliance ingestion subscription ended unexpectedly", { subject, error });
  });

  return subscription;
}

export async function startComplianceIngestor(
  options: ComplianceIngestorOptions = {},
): Promise<ComplianceIngestorRuntime> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set for the compliance ingestor");
  }

  const natsUrl = resolveOption(options.natsUrl ?? process.env.NATS_URL, "nats://localhost:4222");
  const stream = resolveOption(options.stream ?? process.env.NATS_STREAM, "APGMS");
  const subjectPrefix = resolveOption(options.subjectPrefix ?? process.env.NATS_SUBJECT_PREFIX, "apgms.dev");
  const durablePrefix = resolveOption(options.durablePrefix ?? process.env.NATS_DURABLE_PREFIX, "compliance-ingestor");
  const connectionName = options.connectionName ?? "worker.compliance-ingestor";

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await prisma.$connect();

  const connection: NatsConnection = await connect({ servers: natsUrl, name: connectionName });
  const jetstream = connection.jetstream();
  const manager = await connection.jetstreamManager();
  await ensureStream(manager, stream, subjectPrefix);

  const subscriptions: JetStreamSubscription[] = [];
  const fullSubjects = [
    `${subjectPrefix}.ledger.discrepancy`,
    `${subjectPrefix}.compliance.fraud`,
    `${subjectPrefix}.compliance.remediation`,
    `${subjectPrefix}.payments.plan`,
  ];

  for (const subject of fullSubjects) {
    const durableName = `${durablePrefix}-${subject.split(".").slice(-2).join("-")}`;
    const subscription = await subscribe(jetstream, subject, durableName, async (envelope) => {
      await persistEnvelope(prisma, envelope);
      await routeEvent(prisma, envelope);
    });
    subscriptions.push(subscription);
  }

  return {
    stop: async () => {
      await Promise.all(subscriptions.map(async (subscription) => {
        try {
          subscription.unsubscribe();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to unsubscribe from compliance subject", { error });
        }
      }));

      await connection.drain();
      await prisma.$disconnect();
    },
  };
}

