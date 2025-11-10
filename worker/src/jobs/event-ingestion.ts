import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { NatsBus } from "@apgms/shared/messaging/nats-bus.js";
import { prisma } from "@apgms/shared/db.js";

interface BusEnvelope<T = Record<string, unknown>> {
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
}

interface DiscrepancyDetectedPayload {
  discrepancyId?: string;
  key?: string;
  category?: string;
  eventType?: string;
  status?: string;
  severity?: string | null;
  detectedAt?: string;
  shortfallCents?: number | string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  source?: string;
}

interface ManualResolutionPayload {
  discrepancyId?: string;
  resolutionId?: string;
  resolutionType: string;
  overrideAmountCents?: number | string | null;
  notes?: string | null;
  appliedAt?: string | null;
  metadata?: Record<string, unknown>;
  status?: string | null;
  resolvedBy?: { userId?: string; role?: string };
}

interface PaymentPlanPayload {
  paymentPlanId?: string;
  discrepancyId?: string | null;
  arrangementType: string;
  status: string;
  totalOutstandingCents?: number | string | null;
  installmentAmountCents?: number | string | null;
  installmentFrequency?: string | null;
  firstPaymentDue?: string | null;
  nextPaymentDue?: string | null;
  lastPaymentReceived?: string | null;
  missedInstallments?: number | null;
  terms?: Record<string, unknown>;
  notes?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
  updatedBy?: { userId?: string; role?: string };
}

const STREAM = process.env.NATS_STREAM?.trim() || "APGMS";
const SUBJECT_PREFIX = process.env.NATS_SUBJECT_PREFIX?.trim() || "apgms.events";
const DURABLE = process.env.EVENT_INGESTION_DURABLE?.trim() || "training-ledger";

function toBigInt(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return BigInt(Math.trunc(parsed));
    }
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return null;
}

async function buildOrgContext(orgId: string): Promise<Record<string, unknown>> {
  const [employeeCount, latestProfile, recentBasCycles, recentPlanRequests] = await Promise.all([
    prisma.employee.count({ where: { orgId } }),
    prisma.monitoringSnapshot.findFirst({
      where: { orgId, type: "org_profile" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.basCycle.findMany({
      where: { orgId },
      orderBy: { periodEnd: "desc" },
      take: 6,
    }),
    prisma.paymentPlanRequest.findMany({
      where: { orgId },
      orderBy: { requestedAt: "desc" },
      take: 5,
    }),
  ]);

  const sector =
    latestProfile && typeof latestProfile.payload === "object" && latestProfile.payload
      ? (latestProfile.payload as Record<string, unknown>).sector ?? "unknown"
      : "unknown";

  const basAggregation = recentBasCycles.reduce(
    (acc, cycle) => {
      const paygwRequired = Number(cycle.paygwRequired ?? 0);
      const paygwSecured = Number(cycle.paygwSecured ?? 0);
      const gstRequired = Number(cycle.gstRequired ?? 0);
      const gstSecured = Number(cycle.gstSecured ?? 0);
      const required = paygwRequired + gstRequired;
      const secured = paygwSecured + gstSecured;
      acc.totalRequired += required;
      acc.totalSecured += secured;
      acc.statusCounts[cycle.overallStatus] =
        (acc.statusCounts[cycle.overallStatus] ?? 0) + 1;
      return acc;
    },
    { totalRequired: 0, totalSecured: 0, statusCounts: {} as Record<string, number> },
  );

  const coverageRatio =
    basAggregation.totalRequired > 0
      ? basAggregation.totalSecured / basAggregation.totalRequired
      : null;

  const paymentPlanHistory = recentPlanRequests.map((plan) => ({
    id: plan.id,
    status: plan.status,
    requestedAt: plan.requestedAt.toISOString(),
    resolvedAt: plan.resolvedAt ? plan.resolvedAt.toISOString() : null,
  }));

  return {
    employeeCount,
    sector,
    coverageRatio,
    recentBasStatusTally: basAggregation.statusCounts,
    paymentPlanHistory,
  };
}

async function persistDiscrepancyEvent(
  envelope: BusEnvelope<DiscrepancyDetectedPayload>,
): Promise<void> {
  const payload = envelope.payload;
  const discrepancyId = payload.discrepancyId ?? envelope.id;
  const detectedAt = payload.detectedAt ? new Date(payload.detectedAt) : new Date(envelope.ts);
  const context = await buildOrgContext(envelope.orgId);
  const enrichedContext = {
    ...context,
    discrepancy: {
      severity: payload.severity ?? null,
      shortfallCents: toNumber(payload.shortfallCents),
      description: payload.description ?? null,
      metadata: payload.metadata ?? {},
    },
  };

  await prisma.discrepancyEvent.upsert({
    where: { id: discrepancyId },
    update: {
      eventKey: payload.key ?? envelope.key,
      category: payload.category ?? "ledger",
      eventType: payload.eventType ?? envelope.eventType,
      status: payload.status ?? "open",
      severity: payload.severity ?? null,
      source: payload.source ?? envelope.source,
      traceId: envelope.traceId ?? null,
      detectedAt,
      shortfallCents: toBigInt(payload.shortfallCents),
      payload,
      context: enrichedContext,
      resolvedAt: payload.status === "resolved" ? detectedAt : undefined,
    },
    create: {
      id: discrepancyId,
      orgId: envelope.orgId,
      eventKey: payload.key ?? envelope.key,
      category: payload.category ?? "ledger",
      eventType: payload.eventType ?? envelope.eventType,
      status: payload.status ?? "open",
      severity: payload.severity ?? null,
      source: payload.source ?? envelope.source,
      traceId: envelope.traceId ?? null,
      detectedAt,
      shortfallCents: toBigInt(payload.shortfallCents),
      payload,
      context: enrichedContext,
    },
  });
}

async function persistManualResolution(
  envelope: BusEnvelope<ManualResolutionPayload>,
): Promise<void> {
  const payload = envelope.payload;
  if (!payload.discrepancyId) {
    console.warn("manual_resolution_missing_discrepancy", { id: envelope.id });
    return;
  }

  const resolutionId = payload.resolutionId ?? envelope.id ?? randomUUID();
  const appliedAt = payload.appliedAt ? new Date(payload.appliedAt) : null;
  const baseContext = await buildOrgContext(envelope.orgId);
  const existing = await prisma.discrepancyEvent.findUnique({
    where: { id: payload.discrepancyId },
    select: { context: true },
  });
  const mergedContext = {
    ...baseContext,
    ...(existing?.context && typeof existing.context === "object"
      ? (existing.context as Record<string, unknown>)
      : {}),
    lastResolution: {
      resolutionId,
      overrideAmountCents: toNumber(payload.overrideAmountCents),
      status: payload.status ?? "resolved",
      appliedAt: appliedAt ? appliedAt.toISOString() : envelope.ts,
    },
  };

  await prisma.manualResolution.upsert({
    where: { id: resolutionId },
    update: {
      resolvedBy: payload.resolvedBy?.userId ?? "unknown",
      resolvedByRole: payload.resolvedBy?.role ?? null,
      resolutionType: payload.resolutionType,
      overrideAmountCents: toBigInt(payload.overrideAmountCents),
      notes: payload.notes ?? null,
      payload,
      appliedAt,
    },
    create: {
      id: resolutionId,
      discrepancyId: payload.discrepancyId,
      orgId: envelope.orgId,
      resolvedBy: payload.resolvedBy?.userId ?? "unknown",
      resolvedByRole: payload.resolvedBy?.role ?? null,
      resolutionType: payload.resolutionType,
      overrideAmountCents: toBigInt(payload.overrideAmountCents),
      notes: payload.notes ?? null,
      payload,
      appliedAt,
    },
  });

  try {
    await prisma.discrepancyEvent.update({
      where: { id: payload.discrepancyId },
      data: {
        status: payload.status ?? "resolved",
        resolvedAt: appliedAt ?? new Date(envelope.ts),
        context: mergedContext,
      },
    });
  } catch (error) {
    console.warn("manual_resolution_event_without_discrepancy", {
      discrepancyId: payload.discrepancyId,
      resolutionId,
      error,
    });
  }
}

async function persistPaymentPlan(
  envelope: BusEnvelope<PaymentPlanPayload>,
): Promise<void> {
  const payload = envelope.payload;
  const paymentPlanId = payload.paymentPlanId ?? envelope.id;
  const contextBase = await buildOrgContext(envelope.orgId);
  const enrichedContext = {
    ...contextBase,
    paymentPlan: {
      missedInstallments: payload.missedInstallments ?? null,
      metadata: payload.metadata ?? {},
    },
  };

  await prisma.paymentPlanMetadata.upsert({
    where: { id: paymentPlanId },
    update: {
      discrepancyId: payload.discrepancyId ?? null,
      status: payload.status,
      arrangementType: payload.arrangementType,
      totalOutstandingCents: toBigInt(payload.totalOutstandingCents),
      installmentAmountCents: toBigInt(payload.installmentAmountCents),
      installmentFrequency: payload.installmentFrequency ?? null,
      firstPaymentDue: payload.firstPaymentDue ? new Date(payload.firstPaymentDue) : null,
      nextPaymentDue: payload.nextPaymentDue ? new Date(payload.nextPaymentDue) : null,
      lastPaymentReceived: payload.lastPaymentReceived
        ? new Date(payload.lastPaymentReceived)
        : null,
      missedInstallments: payload.missedInstallments ?? null,
      terms: payload.terms ?? null,
      payload,
      notes: payload.notes ?? null,
      updatedBy: payload.updatedBy?.userId ?? null,
      source: payload.source ?? envelope.source,
      context: enrichedContext,
    },
    create: {
      id: paymentPlanId,
      orgId: envelope.orgId,
      discrepancyId: payload.discrepancyId ?? null,
      status: payload.status,
      arrangementType: payload.arrangementType,
      totalOutstandingCents: toBigInt(payload.totalOutstandingCents),
      installmentAmountCents: toBigInt(payload.installmentAmountCents),
      installmentFrequency: payload.installmentFrequency ?? null,
      firstPaymentDue: payload.firstPaymentDue ? new Date(payload.firstPaymentDue) : null,
      nextPaymentDue: payload.nextPaymentDue ? new Date(payload.nextPaymentDue) : null,
      lastPaymentReceived: payload.lastPaymentReceived
        ? new Date(payload.lastPaymentReceived)
        : null,
      missedInstallments: payload.missedInstallments ?? null,
      terms: payload.terms ?? null,
      payload,
      notes: payload.notes ?? null,
      updatedBy: payload.updatedBy?.userId ?? null,
      source: payload.source ?? envelope.source,
      context: enrichedContext,
    },
  });
}

async function handleEnvelope(envelope: BusEnvelope): Promise<void> {
  switch (envelope.eventType) {
    case "ledger.discrepancy.detected":
      await persistDiscrepancyEvent(envelope as BusEnvelope<DiscrepancyDetectedPayload>);
      return;
    case "ledger.discrepancy.manual_resolution":
      await persistManualResolution(envelope as BusEnvelope<ManualResolutionPayload>);
      return;
    case "compliance.payment_plan.updated":
      await persistPaymentPlan(envelope as BusEnvelope<PaymentPlanPayload>);
      return;
    default:
      console.info("event_ignored", {
        eventType: envelope.eventType,
        id: envelope.id,
      });
  }
}

export async function startEventIngestionWorker(): Promise<void> {
  const url = process.env.NATS_URL?.trim();
  if (!url) {
    throw new Error("NATS_URL must be configured for event ingestion worker");
  }

  const connectionName = process.env.NATS_CONNECTION_NAME?.trim() || "apgms-worker-ingestor";

  const bus = await NatsBus.connect({
    url,
    stream: STREAM,
    subjectPrefix: SUBJECT_PREFIX,
    connectionName,
    token: process.env.NATS_TOKEN?.trim() || undefined,
    username: process.env.NATS_USERNAME?.trim() || undefined,
    password: process.env.NATS_PASSWORD?.trim() || undefined,
  });

  const subject = `${SUBJECT_PREFIX}.>`;
  console.log("event_ingestion_worker_started", { subject, durable: DURABLE });

  const unsubscribe = await bus.subscribe(subject, DURABLE, async (message) => {
    try {
      await handleEnvelope(message as BusEnvelope);
    } catch (error) {
      console.error("event_ingestion_failed", {
        eventType: message.eventType,
        id: message.id,
        error,
      });
      throw error;
    }
  });

  let shuttingDown = false;
  let shutdownResolve: (() => void) | null = null;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("event_ingestion_worker_shutdown", { signal });
    try {
      await unsubscribe();
      await bus.close();
      await prisma.$disconnect();
    } catch (error) {
      console.error("event_ingestion_shutdown_error", { error });
    } finally {
      shutdownResolve?.();
    }
  }

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await new Promise<void>((resolve) => {
    shutdownResolve = resolve;
  });

  // small delay to allow logs to flush
  await delay(50);
}

export default startEventIngestionWorker;
