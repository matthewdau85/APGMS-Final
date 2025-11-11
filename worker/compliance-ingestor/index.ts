import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import crypto from "node:crypto";

import { prisma } from "@apgms/shared/db.js";
import type { BusEnvelope } from "@apgms/shared/messaging/event-bus.js";
import { NatsBus } from "@apgms/shared/messaging/nats-bus.js";
import { Prisma } from "@prisma/client";

const SYSTEM_ACTOR = "system:compliance-ingestor";
const SUBJECT_PREFIX = process.env.NATS_SUBJECT_PREFIX?.trim() ?? "apgms";
const STREAM = process.env.NATS_STREAM?.trim() ?? "APGMS";
const SUBJECT = `${SUBJECT_PREFIX}.compliance.>`;
const DURABLE = process.env.NATS_DURABLE?.trim() ?? "compliance-ingestor";
const NATS_URL = process.env.NATS_URL?.trim() ?? "nats://localhost:4222";

let bus: NatsBus | null = null;

export async function startComplianceIngestor(): Promise<void> {
  bus = await NatsBus.connect({
    url: NATS_URL,
    stream: STREAM,
    subjectPrefix: SUBJECT_PREFIX,
    connectionName: "worker-compliance-ingestor",
  });

  await bus.subscribe(SUBJECT, DURABLE, async (envelope) => {
    await processEnvelope(envelope as BusEnvelope<Record<string, unknown>>);
  });
}

async function processEnvelope(envelope: BusEnvelope<Record<string, unknown>>): Promise<void> {
  try {
    const processed = await prisma.$transaction(async (tx) => {
      await tx.eventEnvelope.upsert({
        where: { id: envelope.id },
        update: {
          processedAt: new Date(),
          status: "processed",
          error: null,
          payload: envelope.payload,
        },
        create: {
          id: envelope.id,
          orgId: envelope.orgId,
          eventType: envelope.eventType,
          key: envelope.key,
          ts: new Date(envelope.ts),
          schemaVersion: envelope.schemaVersion,
          source: envelope.source,
          traceId: envelope.traceId,
          payload: envelope.payload,
          processedAt: new Date(),
          status: "processed",
        },
      });

      const context = await buildContext(tx, envelope);
      const features = computeFeatures(envelope.eventType, context);
      const label = deriveLabel(envelope.eventType, context);

      const sample = await tx.complianceTrainingSample.upsert({
        where: { eventId: envelope.id },
        update: {
          orgId: envelope.orgId,
          discrepancyId: context.discrepancy?.id ?? null,
          fraudCaseId: context.fraudCase?.id ?? null,
          paymentPlanId: context.paymentPlan?.id ?? null,
          evidenceArtifactId: context.evidenceArtifactId ?? null,
          eventType: envelope.eventType,
          source: envelope.source,
          label,
          features,
          context: context.snapshot,
        },
        create: {
          orgId: envelope.orgId,
          eventId: envelope.id,
          discrepancyId: context.discrepancy?.id ?? null,
          fraudCaseId: context.fraudCase?.id ?? null,
          paymentPlanId: context.paymentPlan?.id ?? null,
          evidenceArtifactId: context.evidenceArtifactId ?? null,
          eventType: envelope.eventType,
          source: envelope.source,
          label,
          features,
          context: context.snapshot,
        },
      });

      return { context, features, label, sampleId: sample.id };
    });

    await recordAuditLog({
      orgId: envelope.orgId,
      actorId: SYSTEM_ACTOR,
      action: "compliance_event_ingested",
      metadata: {
        eventId: envelope.id,
        eventType: envelope.eventType,
        label: processed.label,
        features: processed.features,
        sampleId: processed.sampleId,
      },
    });

    await materialiseDataset();
  } catch (error) {
    await prisma.eventEnvelope.upsert({
      where: { id: envelope.id },
      update: {
        status: "failed",
        error: (error as Error).message,
      },
      create: {
        id: envelope.id,
        orgId: envelope.orgId,
        eventType: envelope.eventType,
        key: envelope.key,
        ts: new Date(envelope.ts),
        schemaVersion: envelope.schemaVersion,
        source: envelope.source,
        traceId: envelope.traceId,
        payload: envelope.payload,
        processedAt: new Date(),
        status: "failed",
        error: (error as Error).message,
      },
    });
    throw error;
  }
}

type TransactionFn = Parameters<typeof prisma.$transaction>[0];
type PrismaTransactionClient = Parameters<TransactionFn>[0];

type ContextResult = {
  discrepancy?: any;
  fraudCase?: any;
  paymentPlan?: any;
  remediation?: any;
  evidenceArtifactId?: string | null;
  snapshot: Record<string, unknown>;
};

async function buildContext(
  tx: PrismaTransactionClient,
  envelope: BusEnvelope<Record<string, unknown>>,
): Promise<ContextResult> {
  const eventName = envelope.eventType.replace(/^compliance\./, "");
  const payload = envelope.payload ?? {};

  switch (eventName) {
    case "discrepancy.recorded": {
      const discrepancyId = typeof payload.discrepancyId === "string" ? payload.discrepancyId : null;
      if (!discrepancyId) {
        return { snapshot: {} };
      }

      const discrepancy = await tx.complianceDiscrepancy.findUnique({
        where: { id: discrepancyId },
        include: {
          remediationActions: true,
          fraudCases: true,
          paymentPlan: true,
        },
      });
      return {
        discrepancy,
        paymentPlan: discrepancy?.paymentPlan ?? undefined,
        snapshot: {
          remediationCount: discrepancy?.remediationActions.length ?? 0,
          fraudCaseCount: discrepancy?.fraudCases.length ?? 0,
          hasPaymentPlan: Boolean(discrepancy?.paymentPlan),
          severity: discrepancy?.severity,
          status: discrepancy?.status,
        },
      };
    }
    case "fraud_case.opened": {
      const fraudCaseId = typeof payload.fraudCaseId === "string" ? payload.fraudCaseId : null;
      if (!fraudCaseId) {
        return { snapshot: {} };
      }

      const fraudCase = await tx.complianceFraudCase.findUnique({
        where: { id: fraudCaseId },
        include: {
          discrepancy: {
            include: {
              remediationActions: true,
            },
          },
          remediationActions: true,
          paymentPlan: true,
        },
      });
      return {
        fraudCase,
        discrepancy: fraudCase?.discrepancy,
        paymentPlan: fraudCase?.paymentPlan ?? undefined,
        snapshot: {
          remediationCount: fraudCase?.remediationActions.length ?? 0,
          discrepancyStatus: fraudCase?.discrepancy?.status,
          riskBand: fraudCase?.riskBand,
          confidence: payload.confidence,
        },
      };
    }
    case "remediation.logged": {
      const remediationId = typeof payload.remediationId === "string" ? payload.remediationId : null;
      if (!remediationId) {
        return { snapshot: {} };
      }

      const remediation = await tx.complianceRemediationAction.findUnique({
        where: { id: remediationId },
        include: {
          discrepancy: true,
          fraudCase: true,
        },
      });
      return {
        remediation,
        discrepancy: remediation?.discrepancy ?? undefined,
        fraudCase: remediation?.fraudCase ?? undefined,
        evidenceArtifactId: remediation?.evidenceArtifactId ?? null,
        snapshot: {
          status: remediation?.status,
          dueDate: remediation?.dueDate?.toISOString(),
          hasEvidence: Boolean(remediation?.evidenceArtifactId),
        },
      };
    }
    case "payment_plan.created": {
      const paymentPlanId = typeof payload.paymentPlanId === "string" ? payload.paymentPlanId : null;
      if (!paymentPlanId) {
        return { snapshot: {} };
      }

      const paymentPlan = await tx.compliancePaymentPlan.findUnique({
        where: { id: paymentPlanId },
        include: {
          discrepancy: true,
          fraudCase: true,
        },
      });
      return {
        paymentPlan,
        discrepancy: paymentPlan?.discrepancy ?? undefined,
        fraudCase: paymentPlan?.fraudCase ?? undefined,
        snapshot: {
          status: paymentPlan?.status,
          totalDue: payload.totalDue,
          scheduleSize: Array.isArray(payload.schedule) ? payload.schedule.length : 0,
        },
      };
    }
    default:
      return { snapshot: {} };
  }
}

function computeFeatures(
  eventType: string,
  context: ContextResult,
): Record<string, unknown> {
  const eventName = eventType.replace(/^compliance\./, "");
  switch (eventName) {
    case "discrepancy.recorded":
      return {
        remediation_count: context.snapshot.remediationCount ?? 0,
        fraud_case_count: context.snapshot.fraudCaseCount ?? 0,
        has_payment_plan: context.snapshot.hasPaymentPlan ? 1 : 0,
        severity_bucket: context.snapshot.severity ?? "UNKNOWN",
      };
    case "fraud_case.opened":
      return {
        discrepancy_status: context.snapshot.discrepancyStatus ?? "unknown",
        remediation_count: context.snapshot.remediationCount ?? 0,
        risk_band: context.snapshot.riskBand ?? "unrated",
        confidence: context.snapshot.confidence ?? null,
      };
    case "remediation.logged":
      return {
        status: context.snapshot.status ?? "planned",
        has_evidence: context.snapshot.hasEvidence ? 1 : 0,
        overdue: computeOverdue(context.snapshot.dueDate as string | undefined),
      };
    case "payment_plan.created":
      return {
        status: context.snapshot.status ?? "pending",
        total_due: context.snapshot.totalDue ?? null,
        schedule_size: context.snapshot.scheduleSize ?? 0,
      };
    default:
      return {};
  }
}

function deriveLabel(eventType: string, context: ContextResult): string | null {
  const eventName = eventType.replace(/^compliance\./, "");
  switch (eventName) {
    case "discrepancy.recorded":
      return context.discrepancy?.status ?? null;
    case "fraud_case.opened":
      return context.fraudCase?.riskBand ?? null;
    case "remediation.logged":
      return context.remediation?.status ?? null;
    case "payment_plan.created":
      return context.paymentPlan?.status ?? null;
    default:
      return null;
  }
}

function computeOverdue(dueDateIso?: string): number | null {
  if (!dueDateIso) return null;
  const dueDate = new Date(dueDateIso);
  if (Number.isNaN(dueDate.getTime())) return null;
  const now = new Date();
  return now > dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000) : 0;
}

async function materialiseDataset(): Promise<void> {
  const samples = await prisma.complianceTrainingSample.findMany({
    orderBy: { generatedAt: "desc" },
  });
  const datasetPath = resolve(process.cwd(), "artifacts", "compliance", "training-samples.json");
  await mkdir(dirname(datasetPath), { recursive: true });
  await writeFile(datasetPath, JSON.stringify(samples, null, 2), { encoding: "utf8" });
}

type RecordAuditLogParams = {
  orgId: string;
  actorId: string;
  action: string;
  metadata?: Prisma.JsonValue | null;
  timestamp?: Date;
};

async function recordAuditLog({
  orgId,
  actorId,
  action,
  metadata,
  timestamp,
}: RecordAuditLogParams): Promise<void> {
  const previous = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  const createdAt = timestamp ?? new Date();
  const metadataValue = metadata ?? null;
  const prevHash = previous?.hash ?? null;

  const hashPayload = JSON.stringify({
    orgId,
    actorId,
    action,
    metadata: metadataValue,
    createdAt: createdAt.toISOString(),
    prevHash,
  });

  const hash = crypto.createHash("sha256").update(hashPayload).digest("hex");

  await prisma.auditLog.create({
    data: {
      orgId,
      actorId,
      action,
      metadata: metadataValue ?? Prisma.JsonNull,
      createdAt,
      hash,
      prevHash,
    },
  });
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath && resolve(modulePath) === invokedPath) {
  startComplianceIngestor()
    .then(() => {
      process.stdout.write("Compliance ingestor started\n");
    })
    .catch((error) => {
      console.error("Failed to start compliance ingestor", error);
      process.exitCode = 1;
    });

  const shutdown = async () => {
    if (bus) {
      try {
        await bus.close();
      } catch (error) {
        console.error("Failed to close NATS bus", error);
      }
    }
    await prisma.$disconnect();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
