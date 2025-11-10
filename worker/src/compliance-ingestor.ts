import type { BusEnvelope } from "@apgms/shared";
import { NatsBus } from "@apgms/shared";
import { prisma } from "@apgms/shared/db.js";

const config = {
  natsUrl: process.env.NATS_URL ?? "nats://localhost:4222",
  natsStream: process.env.NATS_STREAM ?? "APGMS",
  subjectPrefix: process.env.NATS_SUBJECT_PREFIX ?? "apgms.events",
};

const subjects = {
  ledger: `${config.subjectPrefix}.ledger.>`,
  payments: `${config.subjectPrefix}.payments.>`,
  compliance: `${config.subjectPrefix}.compliance.>`,
} as const;

const orgCache = new Map<string, { name: string; expires: number }>();
const ORG_CACHE_TTL_MS = 5 * 60 * 1000;

export async function runComplianceIngestor(): Promise<void> {
  const bus = await NatsBus.connect({
    url: config.natsUrl,
    stream: config.natsStream,
    subjectPrefix: config.subjectPrefix,
    connectionName: "compliance-ingestor",
  });

  const unsubscribers = await Promise.all([
    bus.subscribe(subjects.ledger, "compliance-ledger", handleEnvelope),
    bus.subscribe(subjects.payments, "compliance-payments", handleEnvelope),
    bus.subscribe(subjects.compliance, "compliance-domain", handleEnvelope),
  ]);

  // eslint-disable-next-line no-console
  console.log("[compliance-ingestor] subscriptions established");

  await waitForShutdown();

  for (const unsubscribe of unsubscribers) {
    await unsubscribe();
  }

  await bus.close();
  await prisma.$disconnect();
}

async function handleEnvelope(message: BusEnvelope): Promise<void> {
  try {
    switch (message.eventType) {
      case "ledger.discrepancy.detected":
        await ingestDiscrepancyEvent(message);
        break;
      case "payments.fraud_alert.raised":
        await ingestFraudAlert(message);
        break;
      case "compliance.remediation.logged":
        await ingestRemediationAction(message);
        break;
      case "compliance.payment_plan.agreed":
        await ingestPaymentPlanAgreement(message);
        break;
      default:
        // ignore other events within the subscribed subjects
        break;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[compliance-ingestor] failed to process event", {
      eventType: message.eventType,
      orgId: message.orgId,
      error,
    });
    throw error;
  }
}

async function ingestDiscrepancyEvent(message: BusEnvelope): Promise<void> {
  const payload = message.payload as LedgerDiscrepancyPayload;
  const orgName = await getOrgName(message.orgId);

  await prisma.discrepancyEvent.upsert({
    where: { id: message.id },
    update: {
      orgNameSnapshot: orgName,
      severity: payload.severity ?? "high",
      status: payload.status ?? "OPEN",
      resolvedAt: toDate(payload.resolvedAt),
      resolutionNote: payload.resolutionNote ?? null,
      context: payload,
    },
    create: {
      id: message.id,
      orgId: message.orgId,
      orgNameSnapshot: orgName,
      eventType: message.eventType,
      category: payload.category ?? "cash_flow",
      severity: payload.severity ?? "high",
      status: payload.status ?? "OPEN",
      source: message.source,
      detectedAt: toDate(payload.detectedAt) ?? new Date(message.ts),
      resolvedAt: toDate(payload.resolvedAt),
      resolutionNote: payload.resolutionNote ?? null,
      context: payload,
    },
  });
}

async function ingestFraudAlert(message: BusEnvelope): Promise<void> {
  const payload = message.payload as PaymentsFraudAlertPayload;
  const orgName = await getOrgName(message.orgId);

  await prisma.fraudAlert.upsert({
    where: { id: message.id },
    update: {
      orgNameSnapshot: orgName,
      discrepancyEventId: payload.discrepancyEventId ?? undefined,
      severity: payload.severity ?? "high",
      status: payload.status ?? "OPEN",
      resolvedAt: toDate(payload.resolvedAt),
      details: payload,
    },
    create: {
      id: message.id,
      orgId: message.orgId,
      orgNameSnapshot: orgName,
      discrepancyEventId: payload.discrepancyEventId ?? null,
      alertType: payload.reason ?? "flagged",
      severity: payload.severity ?? "high",
      status: payload.status ?? "OPEN",
      triggeredAt: toDate(payload.triggeredAt) ?? new Date(message.ts),
      details: payload,
    },
  });
}

async function ingestRemediationAction(message: BusEnvelope): Promise<void> {
  const payload = message.payload as ComplianceRemediationPayload;
  const orgName = await getOrgName(message.orgId);

  await prisma.remediationAction.upsert({
    where: { id: message.id },
    update: {
      orgNameSnapshot: orgName,
      discrepancyEventId: payload.discrepancyEventId ?? undefined,
      fraudAlertId: payload.fraudAlertId ?? undefined,
      owner: payload.owner ?? undefined,
      dueAt: toDate(payload.dueAt) ?? undefined,
      completedAt: toDate(payload.completedAt) ?? undefined,
      status: payload.status ?? "PENDING",
      notes: payload.notes ?? null,
      metadata: payload.metadata ?? {},
    },
    create: {
      id: message.id,
      orgId: message.orgId,
      orgNameSnapshot: orgName,
      discrepancyEventId: payload.discrepancyEventId ?? null,
      fraudAlertId: payload.fraudAlertId ?? null,
      actionType: payload.actionType ?? "remediation",
      owner: payload.owner ?? null,
      dueAt: toDate(payload.dueAt),
      completedAt: toDate(payload.completedAt),
      status: payload.status ?? "PENDING",
      notes: payload.notes ?? null,
      metadata: payload.metadata ?? {},
    },
  });
}

async function ingestPaymentPlanAgreement(message: BusEnvelope): Promise<void> {
  const payload = message.payload as CompliancePaymentPlanPayload;
  const orgName = await getOrgName(message.orgId);

  await prisma.paymentPlanAgreement.upsert({
    where: { id: message.id },
    update: {
      orgNameSnapshot: orgName,
      paymentPlanRequestId: payload.paymentPlanRequestId ?? undefined,
      discrepancyEventId: payload.discrepancyEventId ?? undefined,
      basCycleId: payload.basCycleId ?? undefined,
      status: payload.status ?? "ACTIVE",
      endDate: toDate(payload.endDate) ?? undefined,
      terms: payload.terms ?? {},
    },
    create: {
      id: message.id,
      orgId: message.orgId,
      orgNameSnapshot: orgName,
      paymentPlanRequestId: payload.paymentPlanRequestId ?? null,
      discrepancyEventId: payload.discrepancyEventId ?? null,
      basCycleId: payload.basCycleId ?? null,
      authority: payload.authority ?? "",
      reference: payload.reference ?? message.key,
      status: payload.status ?? "ACTIVE",
      startDate: toDate(payload.startDate) ?? new Date(message.ts),
      endDate: toDate(payload.endDate),
      terms: payload.terms ?? {},
    },
  });
}

async function getOrgName(orgId: string): Promise<string> {
  const cached = orgCache.get(orgId);
  const now = Date.now();
  if (cached && cached.expires > now) {
    return cached.name;
  }

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const name = org?.name ?? "unknown";
  orgCache.set(orgId, { name, expires: now + ORG_CACHE_TTL_MS });
  return name;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

async function waitForShutdown(): Promise<void> {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  const listeners: Array<() => void> = [];
  const promise = new Promise<void>((resolve) => {
    for (const signal of signals) {
      const handler = () => {
        for (const unregister of listeners) unregister();
        resolve();
      };
      listeners.push(() => process.off(signal, handler));
      process.on(signal, handler);
    }
  });
  await promise;
}

// Payload shapes captured from the events emitted by the API gateway handlers.
type LedgerDiscrepancyPayload = {
  category?: string;
  severity?: string;
  status?: string;
  detectedAt?: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  [key: string]: unknown;
};

type PaymentsFraudAlertPayload = {
  discrepancyEventId?: string | null;
  reason?: string;
  severity?: string;
  status?: string;
  triggeredAt?: string;
  resolvedAt?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type ComplianceRemediationPayload = {
  discrepancyEventId?: string | null;
  fraudAlertId?: string | null;
  actionType?: string;
  owner?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  status?: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type CompliancePaymentPlanPayload = {
  paymentPlanRequestId?: string | null;
  discrepancyEventId?: string | null;
  basCycleId?: string | null;
  authority?: string;
  reference?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  terms?: Record<string, unknown> | null;
  [key: string]: unknown;
};

if (process.argv[1] && process.argv[1].endsWith("compliance-ingestor.js")) {
  runComplianceIngestor()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[compliance-ingestor] fatal error", error);
      process.exit(1);
    });
}
