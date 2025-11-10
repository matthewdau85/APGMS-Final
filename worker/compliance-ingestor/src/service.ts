import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { Prisma } from "@prisma/client";
import { prisma } from "@apgms/shared/db";
import { connect, StringCodec } from "nats";

const codec = StringCodec();

const GOVERNANCE_CONTROLS = [
  {
    control: "dsp.logging_evidence",
    reference: "docs/compliance/dsp-operational-framework.md#logging--evidence",
  },
  {
    control: "dsp.security_incident_response",
    reference: "docs/compliance/dsp-operational-framework.md#security-posture--incident-response",
  },
];

const DATASET_DIR = resolve(process.cwd(), "artifacts", "datasets");

export type StructuredEnvelope = {
  id: string;
  eventType: string;
  schemaVersion: string;
  source: string;
  orgId: string;
  entity: {
    type: string;
    id: string;
    status?: string;
    severity?: string;
  };
  summary?: string;
  occurredAt: string;
  correlationId?: string;
  traceId?: string;
  tags?: string[];
  payload: Record<string, unknown>;
  context?: Record<string, unknown>;
};

type DiscrepancyWithRelations = Prisma.ComplianceDiscrepancyGetPayload<{
  include: { remediations: true; fraudSignals: true; paymentPlan: true };
}>;

type OrgContext = {
  id: string;
  name: string | null;
  createdAt: Date | null;
};

export async function startComplianceIngestor(): Promise<void> {
  const natsUrl = process.env.NATS_URL?.trim() || "nats://127.0.0.1:4222";
  const subject = process.env.COMPLIANCE_EVENTS_SUBJECT?.trim() || "compliance.events";
  const queue = process.env.COMPLIANCE_EVENTS_QUEUE?.trim() || "compliance-ingestor";

  const connection = await connect({ servers: natsUrl, name: "compliance-ingestor" });
  const subscription = connection.subscribe(subject, { queue });

  const shutdown = async () => {
    try {
      subscription.unsubscribe();
    } catch {
      // ignore
    }

    try {
      await connection.drain();
    } catch {
      // ignore
    }

    await prisma.$disconnect();
  };

  process.once("SIGINT", () => shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => shutdown().finally(() => process.exit(0)));

  for await (const message of subscription) {
    const raw = codec.decode(message.data);
    try {
      const envelope = JSON.parse(raw) as StructuredEnvelope;
      await ingestEvent(envelope);
    } catch (error) {
      console.error("Failed to process compliance event", { raw, error });
    }
  }
}

async function ingestEvent(event: StructuredEnvelope): Promise<void> {
  const orgContext = await loadOrgContext(event.orgId);

  await prisma.eventEnvelope.upsert({
    where: { id: event.id },
    update: {
      orgId: event.orgId,
      eventType: event.eventType,
      key: event.entity.id,
      ts: new Date(event.occurredAt),
      schemaVersion: event.schemaVersion,
      source: event.source,
      traceId: event.traceId ?? null,
      payload: event as unknown as Prisma.JsonObject,
      processedAt: new Date(),
      status: "processed",
      error: null,
    },
    create: {
      id: event.id,
      orgId: event.orgId,
      eventType: event.eventType,
      key: event.entity.id,
      ts: new Date(event.occurredAt),
      schemaVersion: event.schemaVersion,
      source: event.source,
      traceId: event.traceId ?? null,
      payload: event as unknown as Prisma.JsonObject,
      processedAt: new Date(),
      status: "processed",
      error: null,
    },
  });

  let discrepancy: DiscrepancyWithRelations | null = null;

  switch (event.entity.type) {
    case "discrepancy":
      discrepancy = await upsertDiscrepancy(event);
      break;
    case "fraud":
      discrepancy = await recordFraudSignal(event);
      break;
    case "remediation":
      discrepancy = await recordRemediation(event);
      break;
    case "payment_plan":
      discrepancy = await recordPaymentPlan(event);
      break;
    default:
      discrepancy = await fetchDiscrepancy(event.orgId, event.entity.id);
      break;
  }

  await materialiseTrainingSnapshot(event, orgContext, discrepancy);
}

async function loadOrgContext(orgId: string): Promise<OrgContext> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  return {
    id: orgId,
    name: org?.name ?? null,
    createdAt: org?.createdAt ?? null,
  };
}

async function upsertDiscrepancy(event: StructuredEnvelope): Promise<DiscrepancyWithRelations> {
  const category = typeof event.payload.category === "string" ? event.payload.category : "unspecified";
  const resolvedAt = extractDate(event.payload.resolvedAt);
  await prisma.complianceDiscrepancy.upsert({
    where: {
      orgId_externalRef: {
        orgId: event.orgId,
        externalRef: event.entity.id,
      },
    },
    update: {
      eventType: event.eventType,
      status: event.entity.status ?? undefined,
      severity: event.entity.severity ?? undefined,
      category,
      summary: event.summary ?? undefined,
      detectedAt: new Date(event.occurredAt),
      resolvedAt: resolvedAt ?? undefined,
      payload: event.payload as unknown as Prisma.JsonObject,
    },
    create: {
      orgId: event.orgId,
      externalRef: event.entity.id,
      eventType: event.eventType,
      status: event.entity.status ?? "open",
      severity: event.entity.severity ?? "medium",
      category,
      detectedAt: new Date(event.occurredAt),
      resolvedAt,
      summary: event.summary,
      payload: event.payload as unknown as Prisma.JsonObject,
    },
  });

  return fetchDiscrepancy(event.orgId, event.entity.id);
}

async function recordFraudSignal(event: StructuredEnvelope): Promise<DiscrepancyWithRelations | null> {
  const discrepancyRef = String(
    event.payload.discrepancyExternalRef ?? event.payload.discrepancyId ?? event.entity.id,
  );
  const target = await ensureDiscrepancy(event, discrepancyRef);

  await prisma.complianceFraudSignal.create({
    data: {
      discrepancyId: target.id,
      signalType: String(event.payload.signalType ?? event.eventType),
      riskScore: toNumberOrNull(event.payload.riskScore),
      source: event.source,
      payload: event.payload as unknown as Prisma.JsonObject,
    },
  });

  return fetchDiscrepancy(event.orgId, discrepancyRef);
}

async function recordRemediation(event: StructuredEnvelope): Promise<DiscrepancyWithRelations | null> {
  const discrepancyRef = String(
    event.payload.discrepancyExternalRef ?? event.payload.discrepancyId ?? event.entity.id,
  );
  const target = await ensureDiscrepancy(event, discrepancyRef);

  await prisma.complianceRemediation.create({
    data: {
      discrepancyId: target.id,
      remediationType: String(event.payload.remediationType ?? event.eventType),
      status: String(event.payload.status ?? event.entity.status ?? "pending"),
      openedAt: extractDate(event.payload.openedAt) ?? new Date(event.occurredAt),
      closedAt: extractDate(event.payload.closedAt) ?? null,
      owner: event.payload.owner ? String(event.payload.owner) : null,
      notes: event.payload.notes as unknown as Prisma.JsonValue,
    },
  });

  return fetchDiscrepancy(event.orgId, discrepancyRef);
}

async function recordPaymentPlan(event: StructuredEnvelope): Promise<DiscrepancyWithRelations | null> {
  const discrepancyRef = String(
    event.payload.discrepancyExternalRef ?? event.payload.discrepancyId ?? event.entity.id,
  );
  const target = await ensureDiscrepancy(event, discrepancyRef);
  const rawAmountCents = toNumber(event.payload.amountCents);
  const amountCents = toBigIntCents(rawAmountCents ?? Math.round((toNumber(event.payload.amount) ?? 0) * 100));
  const cadence = String(event.payload.cadence ?? "monthly");

  await prisma.compliancePaymentPlan.upsert({
    where: { discrepancyId: target.id },
    update: {
      status: String(event.payload.status ?? event.entity.status ?? "draft"),
      amountCents,
      cadence,
      schedule: event.payload.schedule as unknown as Prisma.JsonValue,
    },
    create: {
      discrepancyId: target.id,
      orgId: event.orgId,
      status: String(event.payload.status ?? event.entity.status ?? "draft"),
      amountCents,
      cadence,
      schedule: event.payload.schedule as unknown as Prisma.JsonValue,
    },
  });

  return fetchDiscrepancy(event.orgId, discrepancyRef);
}

async function ensureDiscrepancy(event: StructuredEnvelope, externalRef: string) {
  const base = await prisma.complianceDiscrepancy.findUnique({
    where: {
      orgId_externalRef: {
        orgId: event.orgId,
        externalRef,
      },
    },
  });

  if (base) {
    return base;
  }

  const category = typeof event.payload.category === "string" ? event.payload.category : "unspecified";
  return prisma.complianceDiscrepancy.create({
    data: {
      orgId: event.orgId,
      externalRef,
      eventType: event.eventType,
      status: event.entity.status ?? "open",
      severity: event.entity.severity ?? "medium",
      category,
      detectedAt: new Date(event.occurredAt),
      summary: event.summary,
      payload: event.payload as unknown as Prisma.JsonObject,
    },
  });
}

async function fetchDiscrepancy(orgId: string, externalRef: string): Promise<DiscrepancyWithRelations | null> {
  return prisma.complianceDiscrepancy.findUnique({
    where: {
      orgId_externalRef: {
        orgId,
        externalRef,
      },
    },
    include: {
      remediations: true,
      fraudSignals: true,
      paymentPlan: true,
    },
  });
}

async function materialiseTrainingSnapshot(
  event: StructuredEnvelope,
  orgContext: OrgContext,
  discrepancy: DiscrepancyWithRelations | null,
): Promise<void> {
  await mkdir(DATASET_DIR, { recursive: true });

  const label = String(
    event.payload.label ?? (event.entity.status === "closed" ? "remediated" : "requires_review"),
  );

    const rawAmountCents = toNumber(event.payload.amountCents);
  const amountCents = rawAmountCents ?? Math.round((toNumber(event.payload.amount) ?? 0) * 100);
  const severityScore = scoreSeverity(event.entity.severity ?? (event.payload.severity as string | undefined));
  const riskScore = toNumber(event.payload.riskScore) ?? 0;
  const sensitiveAttribute = String(event.payload.sensitiveAttribute ?? "unknown");

  const discrepancyAgeHours = discrepancy
    ? (Date.now() - new Date(discrepancy.detectedAt).getTime()) / 3_600_000
    : null;

  const remediationCount = discrepancy?.remediations.length ?? 0;
  const fraudSignalCount = discrepancy?.fraudSignals.length ?? 0;
  const hasPaymentPlan = discrepancy?.paymentPlan ? 1 : 0;

  const orgTenureDays = orgContext.createdAt
    ? Math.max(0, (Date.now() - orgContext.createdAt.getTime()) / 86_400_000)
    : null;

  const featureRow = {
    eventId: event.id,
    orgId: event.orgId,
    entityType: event.entity.type,
    label,
    severityScore,
    riskScore,
    amountCents,
    status: event.entity.status ?? "unknown",
    statusOpen: event.entity.status === "open" ? 1 : 0,
    statusClosed: event.entity.status === "closed" ? 1 : 0,
    sensitiveAttribute,
    discrepancyAgeHours,
    remediationCount,
    fraudSignalCount,
    hasPaymentPlan,
    orgTenureDays,
    governanceControls: GOVERNANCE_CONTROLS,
  };

  const datasetPath = join(DATASET_DIR, `${event.id}.json`);
  const serialized = JSON.stringify([featureRow], null, 2);
  await writeFile(datasetPath, serialized, { encoding: "utf-8" });

  const sha256 = createHash("sha256").update(serialized).digest("hex");

  const snapshot = await prisma.complianceTrainingSnapshot.create({
    data: {
      orgId: event.orgId,
      discrepancyId: discrepancy?.id ?? null,
      datasetPath,
      label,
      features: featureRow as unknown as Prisma.JsonObject,
      metadata: {
        eventId: event.id,
        traceId: event.traceId ?? null,
        generatedAt: new Date().toISOString(),
        governanceControls: GOVERNANCE_CONTROLS,
      } as unknown as Prisma.JsonObject,
    },
  });

  await prisma.evidenceArtifact.create({
    data: {
      orgId: event.orgId,
      kind: "compliance_training_dataset",
      wormUri: datasetPath,
      sha256,
      payload: {
        eventId: event.id,
        snapshotId: snapshot.id,
        governanceControls: GOVERNANCE_CONTROLS,
        source: event.source,
      } as unknown as Prisma.JsonObject,
    },
  });
}

function extractDate(input: unknown): Date | null {
  if (!input) return null;
  const date = new Date(String(input));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNumberOrNull(value: unknown): number | null {
  return toNumber(value);
}

function toBigIntCents(value: unknown): bigint {
  const cents = toNumber(value);
  if (cents !== null) {
    return BigInt(Math.round(cents));
  }
  return 0n;
}

function scoreSeverity(severity?: string): number {
  switch ((severity ?? "medium").toLowerCase()) {
    case "critical":
      return 1;
    case "high":
      return 0.75;
    case "medium":
      return 0.5;
    case "low":
      return 0.25;
    default:
      return 0.4;
  }
}
