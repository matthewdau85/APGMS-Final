import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DiscrepancyEventKind,
  DiscrepancySeverity,
  FraudAlertStatus,
  Prisma,
  PrismaClient,
  RemediationStatus,
} from "@prisma/client";
import { NatsBus, type BusEnvelope } from "@apgms/shared";

const prisma = new PrismaClient();

const config = {
  natsUrl: process.env.NATS_URL ?? "nats://localhost:4222",
  natsStream: process.env.NATS_STREAM ?? "APGMS",
  subjectPrefix: process.env.NATS_SUBJECT_PREFIX ?? "apgms.dev",
  expectedSchema: "apgms.compliance.v1",
};

const subjects = {
  discrepancy: `${config.subjectPrefix}.compliance.discrepancy`,
  override: `${config.subjectPrefix}.compliance.override`,
};

type ComplianceEventPayload = {
  readonly kind: "DISCREPANCY" | "OVERRIDE";
  readonly category: string;
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
  readonly actor: { readonly type: string; readonly id?: string; readonly role?: string };
  readonly occurredAt: string;
  readonly requestContext?: {
    readonly id?: string;
    readonly method?: string;
    readonly route?: string;
    readonly ip?: string;
  };
};

type TrainingFeatures = {
  readonly overridesLast30Days: number;
  readonly severeEventsLast90Days: number;
  readonly openFraudAlerts: number;
};

const severityScore: Record<ComplianceEventPayload["severity"], number> = {
  LOW: 10,
  MEDIUM: 40,
  HIGH: 70,
  CRITICAL: 90,
};

export async function startComplianceIngestor(): Promise<void> {
  const bus = await NatsBus.connect({
    url: config.natsUrl,
    stream: config.natsStream,
    subjectPrefix: config.subjectPrefix,
    connectionName: "apgms-compliance-ingestor",
  });

  const shutdownTasks: Array<() => Promise<void>> = [];

  const handler = async (message: BusEnvelope): Promise<void> => {
    await handleComplianceEnvelope(message);
  };

  shutdownTasks.push(await bus.subscribe(subjects.discrepancy, "compliance-discrepancy", handler));
  shutdownTasks.push(await bus.subscribe(subjects.override, "compliance-override", handler));

  process.stdout.write("Compliance ingestor worker is running\n");

  const shutdown = async () => {
    try {
      await Promise.allSettled(shutdownTasks.map(async (stop) => stop()));
      await bus.close();
    } finally {
      await prisma.$disconnect();
    }
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

async function handleComplianceEnvelope(envelope: BusEnvelope): Promise<void> {
  if (envelope.schemaVersion !== config.expectedSchema) {
    console.warn("Skipping compliance event with unexpected schema", {
      schema: envelope.schemaVersion,
      id: envelope.id,
    });
    return;
  }

  if (!isComplianceEventPayload(envelope.payload)) {
    console.warn("Skipping compliance event with malformed payload", {
      id: envelope.id,
    });
    return;
  }

  const payload = envelope.payload;
  const org = await prisma.org.findUnique({
    where: { id: envelope.orgId },
    select: { id: true, name: true },
  });

  if (!org) {
    console.warn("Compliance event references unknown org", {
      orgId: envelope.orgId,
      eventId: envelope.id,
    });
    return;
  }

  const eventMeta = sanitizeMetadata(payload.metadata);
  let occurredAt = new Date(payload.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    occurredAt = new Date(envelope.ts);
  }
  const detectedAt = new Date(envelope.ts);

  try {
    const eventRecord = await prisma.discrepancyEvent.upsert({
      where: { busEventId: envelope.id },
      update: {
        dedupeId: envelope.dedupeId,
        kind: mapKind(payload),
        category: payload.category,
        severity: mapSeverity(payload.severity),
        source: envelope.source,
        description: payload.description ?? null,
        actorType: payload.actor.type,
        actorId: payload.actor.id ?? null,
        actorRole: payload.actor.role ?? null,
        metadata: eventMeta,
        occurredAt,
        detectedAt,
        schemaVersion: envelope.schemaVersion,
        orgNameSnapshot: org.name,
        traceId: envelope.traceId ?? null,
      },
      create: {
        orgId: org.id,
        busEventId: envelope.id,
        dedupeId: envelope.dedupeId,
        kind: mapKind(payload),
        category: payload.category,
        severity: mapSeverity(payload.severity),
        source: envelope.source,
        description: payload.description ?? null,
        actorType: payload.actor.type,
        actorId: payload.actor.id ?? null,
        actorRole: payload.actor.role ?? null,
        metadata: eventMeta,
        occurredAt,
        detectedAt,
        schemaVersion: envelope.schemaVersion,
        orgNameSnapshot: org.name,
        traceId: envelope.traceId ?? null,
      },
    });

    const features = await computeTrainingFeatures(org.id);

    await prisma.discrepancyEvent.update({
      where: { id: eventRecord.id },
      data: { metadata: buildMetadataObject(eventMeta, features) },
    });

    let fraudAlertId: string | null = null;
    if (shouldOpenFraudAlert(payload)) {
      const alertDetails = buildMetadataObject(eventMeta, features);
      const riskScore = severityScore[payload.severity];
      const alert = await prisma.fraudAlert.upsert({
        where: { sourceEventId: envelope.id },
        update: {
          status: FraudAlertStatus.OPEN,
          riskScore,
          summary: payload.description ?? `Discrepancy detected: ${payload.category}`,
          details: alertDetails,
          discrepancyId: eventRecord.id,
        },
        create: {
          orgId: org.id,
          discrepancyId: eventRecord.id,
          sourceEventId: envelope.id,
          status: FraudAlertStatus.OPEN,
          riskScore,
          summary: payload.description ?? `Discrepancy detected: ${payload.category}`,
          details: alertDetails,
        },
      });
      fraudAlertId = alert.id;
    }

    const actionType = payload.kind === "OVERRIDE" ? "REVIEW_OVERRIDE" : "INVESTIGATE_DISCREPANCY";
    const dueAt = calculateDueAt(payload.severity);
    const actionMetadata = buildMetadataObject(eventMeta, features);

    await prisma.remediationAction.upsert({
      where: { sourceEventId: envelope.id },
      update: {
        discrepancyId: eventRecord.id,
        fraudAlertId,
        actionType,
        status: RemediationStatus.PENDING,
        notes: payload.description ?? null,
        dueAt,
        metadata: actionMetadata,
      },
      create: {
        orgId: org.id,
        discrepancyId: eventRecord.id,
        fraudAlertId,
        sourceEventId: envelope.id,
        actionType,
        status: RemediationStatus.PENDING,
        notes: payload.description ?? null,
        dueAt,
        metadata: actionMetadata,
      },
    });
  } catch (error) {
    console.error("Failed to persist compliance event", {
      eventId: envelope.id,
      error,
    });
    throw error;
  }
}

function isComplianceEventPayload(value: unknown): value is ComplianceEventPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<ComplianceEventPayload>;
  return (
    payload.kind === "DISCREPANCY" || payload.kind === "OVERRIDE"
  ) && typeof payload.category === "string" && typeof payload.severity === "string" && typeof payload.occurredAt === "string" && !!payload.actor;
}

function mapKind(payload: ComplianceEventPayload): DiscrepancyEventKind {
  if (payload.kind === "OVERRIDE") {
    return DiscrepancyEventKind.CONTROL_OVERRIDE;
  }
  if (severityRank(payload.severity) >= severityRank("HIGH")) {
    return DiscrepancyEventKind.FRAUD_SIGNAL;
  }
  return DiscrepancyEventKind.DATA_INTEGRITY;
}

function mapSeverity(value: ComplianceEventPayload["severity"]): DiscrepancySeverity {
  switch (value) {
    case "LOW":
      return DiscrepancySeverity.LOW;
    case "MEDIUM":
      return DiscrepancySeverity.MEDIUM;
    case "HIGH":
      return DiscrepancySeverity.HIGH;
    case "CRITICAL":
    default:
      return DiscrepancySeverity.CRITICAL;
  }
}

function shouldOpenFraudAlert(payload: ComplianceEventPayload): boolean {
  return (
    payload.kind === "DISCREPANCY" && severityRank(payload.severity) >= severityRank("HIGH")
  );
}

function severityRank(value: ComplianceEventPayload["severity"]): number {
  switch (value) {
    case "LOW":
      return 1;
    case "MEDIUM":
      return 2;
    case "HIGH":
      return 3;
    case "CRITICAL":
    default:
      return 4;
  }
}

function calculateDueAt(severity: ComplianceEventPayload["severity"]): Date {
  const hours = severity === "CRITICAL"
    ? 6
    : severity === "HIGH"
      ? 24
      : severity === "MEDIUM"
        ? 72
        : 168;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function computeTrainingFeatures(orgId: string): Promise<TrainingFeatures> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

  const [overridesLast30Days, severeEventsLast90Days, openFraudAlerts] = await Promise.all([
    prisma.discrepancyEvent.count({
      where: {
        orgId,
        kind: DiscrepancyEventKind.CONTROL_OVERRIDE,
        occurredAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.discrepancyEvent.count({
      where: {
        orgId,
        severity: { in: [DiscrepancySeverity.HIGH, DiscrepancySeverity.CRITICAL] },
        occurredAt: { gte: ninetyDaysAgo },
      },
    }),
    prisma.fraudAlert.count({
      where: {
        orgId,
        status: { in: [FraudAlertStatus.OPEN, FraudAlertStatus.INVESTIGATING] },
      },
    }),
  ]);

  return {
    overridesLast30Days,
    severeEventsLast90Days,
    openFraudAlerts,
  };
}

function sanitizeMetadata(value: Record<string, unknown> | undefined): Prisma.JsonObject {
  if (!value) {
    return {} as Prisma.JsonObject;
  }
  return serializeJson(value) as Prisma.JsonObject;
}

function buildMetadataObject(
  event: Prisma.JsonObject,
  features: TrainingFeatures,
): Prisma.JsonObject {
  return {
    event,
    features,
  } as Prisma.JsonObject;
}

function serializeJson(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeJson(entry));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        result[key] = serializeJson(entry);
      }
    }
    return result;
  }
  return value ?? null;
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  startComplianceIngestor().catch(async (error) => {
    console.error("Compliance ingestor worker failed", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
}
