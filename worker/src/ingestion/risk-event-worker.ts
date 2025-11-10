import { Prisma, FraudAlertStatus, PaymentPlanCommitmentStatus, RemediationActionStatus } from "@prisma/client";
import { NatsBus, type BusEnvelope } from "@apgms/shared";
import { prisma } from "@apgms/shared/db.js";

export type Logger = Pick<typeof console, "info" | "error" | "warn">;

export interface RiskEventIngestionOptions {
  natsUrl?: string;
  natsStream?: string;
  subjectPrefix?: string;
  durableName?: string;
  connectionName?: string;
  logger?: Logger;
  bus?: NatsBus;
}

export interface RiskEventWorkerHandle {
  stop(): Promise<void>;
}

type RiskEventPayload = {
  severity?: string;
  actorId?: string;
  recommendedCommitment?: {
    dueDate?: string;
    amount?: unknown;
    rationale?: unknown;
    paymentPlanRequestId?: string;
  };
  [key: string]: unknown;
};

const DEFAULT_STREAM = "APGMS_RISK";
const DEFAULT_PREFIX = "apgms.risk";
const DEFAULT_DURABLE = "risk-event-ingestor";

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

const toDecimal = (value: unknown): Prisma.Decimal => {
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value as Prisma.Decimal.Value);
  }
  return new Prisma.Decimal(0);
};

const deriveSeverity = (eventType: string, payload: RiskEventPayload): string => {
  if (payload.severity && typeof payload.severity === "string") {
    return payload.severity;
  }
  if (eventType.startsWith("fraud.")) return "high";
  if (eventType === "discrepancy.balance_drift") return "high";
  return "medium";
};

async function persistRiskEvent(
  message: BusEnvelope<RiskEventPayload>,
  logger: Logger,
): Promise<void> {
  let existing: { id: string } | null = null;

  if (typeof message.dedupeId === "string" && message.dedupeId.length > 0) {
    existing = await prisma.discrepancyEvent.findUnique({
      where: {
        orgId_dedupeId: { orgId: message.orgId, dedupeId: message.dedupeId },
      },
      select: { id: true },
    });
  }

  if (!existing) {
    existing = await prisma.discrepancyEvent.findUnique({
      where: { id: message.id },
      select: { id: true },
    });
  }

  if (existing) {
    logger.info({ id: existing.id, dedupeId: message.dedupeId }, "risk_event_duplicate_skipped");
    return;
  }

  const payload = (message.payload ?? {}) as RiskEventPayload;
  const severity = deriveSeverity(message.eventType, payload);
  const occurredAt = toDate(message.ts);
  const orgContext = await prisma.org.findUnique({
    where: { id: message.orgId },
    select: { id: true, name: true },
  });

  await prisma.$transaction(async (tx) => {
    const discrepancy = await tx.discrepancyEvent.create({
      data: {
        id: message.id,
        orgId: message.orgId,
        eventType: message.eventType,
        severity,
        source: message.source,
        key: message.key,
        schemaVersion: message.schemaVersion,
        occurredAt,
        receivedAt: new Date(),
        traceId: message.traceId,
        dedupeId: message.dedupeId,
        details: payload,
      },
    });

    let remediation: { id: string } | null = null;

    if (message.eventType.startsWith("fraud.")) {
      await tx.fraudAlert.create({
        data: {
          orgId: message.orgId,
          discrepancyId: discrepancy.id,
          status: FraudAlertStatus.OPEN,
          severity,
          summary:
            typeof payload.reason === "string" && payload.reason.length > 0
              ? (payload.reason as string)
              : message.eventType,
          evidence: payload,
        },
      });

      remediation = await tx.remediationAction.create({
        data: {
          orgId: message.orgId,
          discrepancyId: discrepancy.id,
          actionType: "review_override",
          status: RemediationActionStatus.PENDING,
          createdBy: typeof payload.actorId === "string" ? payload.actorId : null,
          notes: payload,
        },
      });
    }

    if (message.eventType === "discrepancy.balance_drift") {
      remediation = await tx.remediationAction.create({
        data: {
          orgId: message.orgId,
          discrepancyId: discrepancy.id,
          actionType: "reconcile_balance",
          status: RemediationActionStatus.PENDING,
          createdBy: typeof payload.actorId === "string" ? payload.actorId : null,
          notes: payload,
        },
      });

      if (payload.recommendedCommitment?.dueDate && remediation) {
        await tx.paymentPlanCommitment.create({
          data: {
            orgId: message.orgId,
            discrepancyId: discrepancy.id,
            remediationActionId: remediation.id,
            paymentPlanRequestId:
              typeof payload.recommendedCommitment.paymentPlanRequestId === "string"
                ? payload.recommendedCommitment.paymentPlanRequestId
                : null,
            dueDate: toDate(payload.recommendedCommitment.dueDate),
            amount: toDecimal(payload.recommendedCommitment.amount ?? 0),
            status: PaymentPlanCommitmentStatus.SCHEDULED,
            metadata: payload.recommendedCommitment,
          },
        });
      }
    }

    await tx.trainingSnapshot.create({
      data: {
        orgId: message.orgId,
        discrepancyId: discrepancy.id,
        snapshotType: "risk_event",
        effectiveAt: occurredAt,
        payload: {
          envelopeId: message.id,
          eventType: message.eventType,
          severity,
          source: message.source,
          org: orgContext ?? null,
          payload,
        },
      },
    });
  });
}

export async function startRiskEventIngestionWorker(
  options: RiskEventIngestionOptions = {},
): Promise<RiskEventWorkerHandle> {
  const logger = options.logger ?? console;
  const bus =
    options.bus ??
    (await NatsBus.connect({
      url: options.natsUrl ?? process.env.NATS_URL ?? "nats://localhost:4222",
      stream: options.natsStream ?? process.env.NATS_STREAM ?? DEFAULT_STREAM,
      subjectPrefix: options.subjectPrefix ?? process.env.NATS_SUBJECT_PREFIX ?? DEFAULT_PREFIX,
      connectionName: options.connectionName ?? "risk-event-ingestion-worker",
    }));

  const subjectPrefix = options.subjectPrefix ?? process.env.NATS_SUBJECT_PREFIX ?? DEFAULT_PREFIX;
  const subject = `${subjectPrefix}.events`;
  const durable = options.durableName ?? DEFAULT_DURABLE;

  const unsubscribe = await bus.subscribe(subject, durable, async (message) => {
    try {
      await persistRiskEvent(message as BusEnvelope<RiskEventPayload>, logger);
    } catch (error) {
      logger.error({ err: error, eventId: message.id }, "risk_event_ingest_failed");
      throw error;
    }
  });

  logger.info({ subject, durable }, "risk_event_ingestor_started");

  return {
    stop: async () => {
      await unsubscribe();
      if (!options.bus) {
        await bus.close();
      }
      logger.info("risk_event_ingestor_stopped");
    },
  };
}
