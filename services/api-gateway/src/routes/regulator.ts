// services/api-gateway/src/routes/regulator.ts
import type { PrismaClient } from "@prisma/client";
import type { JsonValue } from "@prisma/client/runtime/library.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { recordAuditLog } from "../lib/audit.js";

type RegulatorRequest = FastifyRequest & {
  user?: { orgId?: string; sub?: string };
  regulatorSession?: { id: string; orgId: string };
};

const MAX_SNAPSHOTS = 20;

type FindMany<T> = (args: unknown) => Promise<T[]>;
type FindFirst<T> = (args: unknown) => Promise<T | null>;
type CountFn = (args: unknown) => Promise<number>;

type BasCycleRecord = {
  periodStart: Date;
  periodEnd: Date;
  lodgedAt: Date | null;
  overallStatus: string;
  paygwSecured?: unknown;
  paygwRequired?: unknown;
  gstSecured?: unknown;
  gstRequired?: unknown;
  orgId: string;
};

type PaymentPlanRecord = {
  id: string;
  basCycleId: string;
  requestedAt: Date;
  status: string;
  reason: string | null;
  detailsJson?: unknown;
  resolvedAt: Date | null;
};

type AlertRecord = {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
};

type MonitoringSnapshotRecord = {
  id: string;
  type: string;
  payload: unknown;
  createdAt: Date;
};

type EvidenceArtifactRecord = {
  id: string;
  kind: string;
  sha256: string;
  wormUri: string | null;
  createdAt: Date;
  payload?: unknown;
  orgId: string;
};

type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  createdAt?: Date;
  amount: unknown;
  narrative?: string | null;
};

type DesignatedAccountRecord = {
  type: string;
  balance?: unknown;
};

type AggregateResult = {
  _count?: { id?: number | null } | null;
  _sum?: { amount?: number | null } | null;
};

type RegulatorPrisma = {
  basCycle: {
    findMany: FindMany<BasCycleRecord>;
    findFirst: FindFirst<BasCycleRecord>;
  };
  paymentPlanRequest: {
    findMany: FindMany<PaymentPlanRecord>;
  };
  alert: {
    count: CountFn;
    findMany: FindMany<AlertRecord>;
  };
  designatedAccount?: {
    findMany: FindMany<DesignatedAccountRecord>;
  };
  monitoringSnapshot: {
    findMany: FindMany<MonitoringSnapshotRecord>;
  };
  evidenceArtifact: {
    findMany: FindMany<EvidenceArtifactRecord>;
    findUnique: (args: unknown) => Promise<EvidenceArtifactRecord | null>;
  };
  bankLine: {
    aggregate: (args: unknown) => Promise<AggregateResult>;
    findFirst: FindFirst<BankLineRecord>;
    findMany: FindMany<BankLineRecord>;
  };
};

type RegulatorRoutesDeps = {
  prisma?: RegulatorPrisma;
  auditLogger?: typeof recordAuditLog;
};

function ensureOrgId(request: RegulatorRequest): string {
  const orgId = request.user?.orgId ?? request.regulatorSession?.orgId;
  if (!orgId) {
    throw new Error("regulator_org_missing");
  }
  return orgId;
}

function actorIdFrom(request: RegulatorRequest): string {
  return request.regulatorSession?.id ?? request.user?.sub ?? "regulator";
}

async function logRegulatorAction(
  request: RegulatorRequest,
  action: string,
  metadata: Record<string, unknown | null> | undefined,
  auditLogger?: RegulatorRoutesDeps["auditLogger"],
) {
  const logger = auditLogger ?? recordAuditLog;
  await logger({
    orgId: ensureOrgId(request),
    actorId: actorIdFrom(request),
    action,
    metadata:
      metadata == null
        ? null
        : (JSON.parse(JSON.stringify(metadata)) as JsonValue),
  });
}

function toNumber(value: unknown | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function formatPeriod(start: Date, end: Date): string {
  return `${start.toISOString().slice(0, 10)}-${end.toISOString().slice(0, 10)}`;
}

export async function registerRegulatorRoutes(
  app: FastifyInstance,
  deps: RegulatorRoutesDeps = {},
) {
  const db: RegulatorPrisma = deps.prisma ?? prisma;
  const auditLogger = deps.auditLogger;

  app.get("/health", async (request: RegulatorRequest) => {
    await logRegulatorAction(request, "regulator.health", undefined, auditLogger);
    return { ok: true, service: "regulator" };
  });

  app.get("/compliance/report", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);

    const designatedAccountsPromise = db.designatedAccount
      ? db.designatedAccount.findMany({ where: { orgId } })
      : Promise.resolve<DesignatedAccountRecord[]>([]);

    const [
      basCycles,
      paymentPlans,
      openHighSeverity,
      resolvedThisQuarter,
      designatedAccounts,
    ] = await Promise.all([
      db.basCycle.findMany({
        where: { orgId },
        orderBy: { periodStart: "desc" },
      }),
      db.paymentPlanRequest.findMany({
        where: { orgId },
        orderBy: { requestedAt: "desc" },
      }),
      db.alert.count({
        where: { orgId, severity: "HIGH", resolvedAt: null },
      }),
      db.alert.count({
        where: {
          orgId,
          resolvedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
      designatedAccountsPromise,
    ]);

    const basHistory = basCycles.map((cycle: BasCycleRecord) => ({
      period: formatPeriod(cycle.periodStart, cycle.periodEnd),
      lodgedAt: cycle.lodgedAt?.toISOString() ?? null,
      status: cycle.overallStatus,
      notes: `PAYGW ${toNumber(cycle.paygwSecured)} / ${toNumber(
        cycle.paygwRequired,
      )} · GST ${toNumber(cycle.gstSecured)} / ${toNumber(cycle.gstRequired)}`,
    }));

    const paymentPlanHistory = paymentPlans.map((plan: PaymentPlanRecord) => ({
      id: plan.id,
      basCycleId: plan.basCycleId,
      requestedAt: plan.requestedAt.toISOString(),
      status: plan.status,
      reason: plan.reason,
      details: plan.detailsJson ?? {},
      resolvedAt: plan.resolvedAt?.toISOString() ?? null,
    }));

    const totals = designatedAccounts.reduce(
      (acc: { paygw: number; gst: number }, account: DesignatedAccountRecord) => {
        if (account.type === "PAYGW") {
          acc.paygw += Number(account.balance ?? 0);
        } else if (account.type === "GST") {
          acc.gst += Number(account.balance ?? 0);
        }
        return acc;
      },
      { paygw: 0, gst: 0 },
    );

    const nextBasCycle = await db.basCycle.findFirst({
      where: { orgId, lodgedAt: null },
      orderBy: { periodEnd: "asc" },
    });

    await logRegulatorAction(
      request,
      "regulator.compliance.report",
      { basPeriods: basHistory.length },
      auditLogger,
    );

    return {
      orgId,
      basHistory,
      paymentPlans: paymentPlanHistory,
      alertsSummary: {
        openHighSeverity,
        resolvedThisQuarter,
      },
      nextBasDue: nextBasCycle?.periodEnd?.toISOString() ?? null,
      designatedTotals: {
        paygw: totals.paygw,
        gst: totals.gst,
      },
    };
  });

  app.get("/alerts", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);
    const alerts: AlertRecord[] = await db.alert.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });

    await logRegulatorAction(
      request,
      "regulator.alerts.list",
      { count: alerts.length },
      auditLogger,
    );

    return {
      alerts: alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        createdAt: alert.createdAt.toISOString(),
        resolved: alert.resolvedAt != null,
        resolvedAt: alert.resolvedAt?.toISOString() ?? null,
      })),
    };
  });

  app.get("/monitoring/snapshots", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);

    const querySchema = z.object({
      limit: z
        .union([z.string(), z.number()])
        .transform((val) => Number(val))
        .pipe(z.number().int().min(1).max(MAX_SNAPSHOTS))
        .optional()
        .default(5),
    });

    const parsed = querySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return {
        error: { code: "invalid_query", details: parsed.error.flatten() },
      };
    }
    const limit = parsed.data.limit;

    const snapshots: MonitoringSnapshotRecord[] = await db.monitoringSnapshot.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    await logRegulatorAction(
      request,
      "regulator.monitoring.snapshots",
      { limit },
      auditLogger,
    );

    return {
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        type: snapshot.type,
        createdAt: snapshot.createdAt.toISOString(),
        payload: snapshot.payload,
      })),
    };
  });

  app.get("/evidence", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);
    const artifacts: EvidenceArtifactRecord[] = await db.evidenceArtifact.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    await logRegulatorAction(
      request,
      "regulator.evidence.list",
      { count: artifacts.length },
      auditLogger,
    );

    return {
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        sha256: artifact.sha256,
        wormUri: artifact.wormUri,
        createdAt: artifact.createdAt.toISOString(),
      })),
    };
  });

  app.get("/evidence/:artifactId", async (request: RegulatorRequest, reply) => {
    const orgId = ensureOrgId(request);
    const paramsSchema = z.object({ artifactId: z.string().min(1) });

    const parsed = paramsSchema.safeParse(request.params ?? {});
    if (!parsed.success) {
      reply
        .code(400)
        .send({ error: { code: "invalid_params", details: parsed.error.flatten() } });
      return;
    }

    const artifact = await db.evidenceArtifact.findUnique({
      where: { id: parsed.data.artifactId },
    });
    if (!artifact || artifact.orgId !== orgId) {
      reply.code(404).send({ error: "artifact_not_found" });
      return;
    }

    await logRegulatorAction(
      request,
      "regulator.evidence.detail",
      { artifactId: artifact.id },
      auditLogger,
    );

    return {
      artifact: {
        id: artifact.id,
        kind: artifact.kind,
        sha256: artifact.sha256,
        wormUri: artifact.wormUri,
        createdAt: artifact.createdAt.toISOString(),
        payload: artifact.payload ?? null,
      },
    };
  });

  app.get("/bank-lines/summary", async (request: RegulatorRequest) => {
    const orgId = ensureOrgId(request);
    const [aggregate, firstEntry, lastEntry, recent]: [
      Awaited<ReturnType<RegulatorPrisma["bankLine"]["aggregate"]>>,
      BankLineRecord | null,
      BankLineRecord | null,
      BankLineRecord[],
    ] = await Promise.all([
      db.bankLine.aggregate({
        where: { orgId },
        _count: { id: true },
        _sum: { amount: true },
      }),
      db.bankLine.findFirst({
        where: { orgId },
        orderBy: { date: "asc" },
      }),
      db.bankLine.findFirst({
        where: { orgId },
        orderBy: { date: "desc" },
      }),
      db.bankLine.findMany({
        where: { orgId },
        orderBy: { date: "desc" },
        take: 5,
      }),
    ]);

    await logRegulatorAction(
      request,
      "regulator.bank.summary",
      { entries: aggregate._count?.id ?? 0 },
      auditLogger,
    );

    return {
      summary: {
        totalEntries: aggregate._count?.id ?? 0,
        totalAmount: Number(aggregate._sum?.amount ?? 0),
        firstEntryAt: firstEntry?.createdAt?.toISOString() ?? null,
        lastEntryAt: lastEntry?.createdAt?.toISOString() ?? null,
      },
      recent: recent.map((line: BankLineRecord) => ({
        id: line.id,
        date: line.date.toISOString(),
        amount: Number(line.amount),
      })),
    };
  });
}
