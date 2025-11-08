import Fastify, { FastifyInstance, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import {
  Prisma,
  Alert as AlertModel,
  BasCycle as BasCycleModel,
  DesignatedAccount as DesignatedAccountModel,
  DesignatedTransfer as DesignatedTransferModel,
  PaymentPlanRequest as PaymentPlanRequestModel,
  MonitoringSnapshot as MonitoringSnapshotModel,
} from "@prisma/client";
import crypto from "node:crypto";
import { context, trace } from "@opentelemetry/api";
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "@apgms/shared";
import {
  AlertResolveBodySchema,
  AlertResolveParamsSchema,
  BankLineCreateSchema,
  BasLodgeBodySchema,
  BasPaymentPlanBodySchema,
  BasPaymentPlanQuerySchema,
  OrgScopedParamsSchema,
} from "@apgms/shared";

// NOTE: make sure config.ts exports what we discussed earlier,
// including cors.allowedOrigins: string[]
import { config } from "./config.js";

import rateLimit from "./plugins/rate-limit.js";
import { authGuard, createAuthGuard, REGULATOR_AUDIENCE } from "./auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerRegulatorAuthRoutes } from "./routes/regulator-auth.js";
import { prisma } from "./db.js";
import { parseWithSchema } from "./lib/validation.js";
import {
  verifyChallenge,
  requireRecentVerification,
  type VerifyChallengeResult,
} from "./security/mfa.js";
import { recordAuditLog } from "./lib/audit.js";
import { ensureRegulatorSessionActive } from "./lib/regulator-session.js";
import { withIdempotency } from "./lib/idempotency.js";
import { metrics, promRegister } from "./observability/metrics.js";
import { attachPrismaMetrics } from "./observability/prisma-metrics.js";
import { closeProviders, initProviders } from "./providers.js";
import {
  createContentAddressedUri,
  resolveScopeForKind,
  type WormProvider,
  type WormScope,
} from "../../../providers/worm/index.js";

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

type DesignatedAccountView = {
  id: string;
  type: string;
  balance: number;
  updatedAt: string;
  transfers: Array<{
    id: string;
    amount: number;
    source: string;
    createdAt: string;
  }>;
};

type DesignatedAccountContext = {
  accounts: DesignatedAccountView[];
  totals: {
    paygw: number;
    gst: number;
  };
};

type PaymentPlanSummary = {
  id: string;
  basCycleId: string;
  requestedAt: string;
  status: string;
  reason: string;
  details: Record<string, unknown>;
  resolvedAt: string | null;
};

type ComplianceReportPayload = {
  orgId: string;
  basHistory: Array<{
    period: string;
    lodgedAt: string | null;
    status: string;
    notes: string;
  }>;
  paymentPlans: PaymentPlanSummary[];
  alertsSummary: {
    openHighSeverity: number;
    resolvedThisQuarter: number;
  };
  nextBasDue: string | null;
  designatedTotals: {
    paygw: number;
    gst: number;
  };
};

const SHORTFALL_ALERT_THRESHOLD = Number.parseFloat(
  process.env.APGMS_SHORTFALL_ALERT_THRESHOLD ?? "500",
);

function retentionDaysForScope(scope: WormScope): number {
  return scope === "bank"
    ? config.retention.bankRetentionDays
    : config.retention.evidenceRetentionDays;
}

function shapeAlert(alert: AlertModel) {
  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    createdAt: alert.createdAt,
    resolved: Boolean(alert.resolvedAt),
    resolvedAt: alert.resolvedAt ?? null,
    resolutionNote: alert.resolutionNote ?? null,
  };
}

function shapeBasPreview(
  cycle: BasCycleModel | null,
  balances?: { paygw: number; gst: number }
) {
  if (!cycle) {
    return null;
  }

  const paygwRequired = decimalToNumber(cycle.paygwRequired);
  const paygwSecured =
    balances?.paygw ?? decimalToNumber(cycle.paygwSecured);
  const paygwShortfall = Math.max(0, paygwRequired - paygwSecured);
  const gstRequired = decimalToNumber(cycle.gstRequired);
  const gstSecured = balances?.gst ?? decimalToNumber(cycle.gstSecured);
  const gstShortfall = Math.max(0, gstRequired - gstSecured);

  const paygwStatus = paygwShortfall <= 0 ? "READY" : "BLOCKED";
  const gstStatus = gstShortfall <= 0 ? "READY" : "BLOCKED";
  const overallStatus =
    paygwStatus === "READY" && gstStatus === "READY" ? "READY" : "BLOCKED";

  const blockers: string[] = [];
  if (paygwShortfall > 0) {
    blockers.push(
      `PAYGW not fully funded. $${paygwShortfall.toFixed(
        2
      )} short. Transfer to ATO is halted until funded or plan requested.`
    );
  }
  if (gstShortfall > 0) {
    blockers.push(
      `GST not fully funded. $${gstShortfall.toFixed(
        2
      )} short. Review daily capture and top up the holding account.`
    );
  }

  return {
    id: cycle.id,
    periodStart: cycle.periodStart.toISOString(),
    periodEnd: cycle.periodEnd.toISOString(),
    paygw: {
      required: paygwRequired,
      secured: paygwSecured,
      status: paygwStatus,
      shortfall: Number(paygwShortfall.toFixed(2)),
    },
    gst: {
      required: gstRequired,
      secured: gstSecured,
      status: gstStatus,
      shortfall: Number(gstShortfall.toFixed(2)),
    },
    overallStatus,
    blockers,
    lodgedAt: cycle.lodgedAt ?? null,
  };
}

function shapePaymentPlan(request: PaymentPlanRequestModel): PaymentPlanSummary {
  let parsedDetails: Record<string, unknown> = {};
  try {
    parsedDetails =
      typeof request.detailsJson === "object" && request.detailsJson !== null
        ? (request.detailsJson as Record<string, unknown>)
        : JSON.parse(String(request.detailsJson));
  } catch (error) {
    parsedDetails = { raw: request.detailsJson, parseError: String(error) };
  }

  return {
    id: request.id,
    basCycleId: request.basCycleId,
    requestedAt: request.requestedAt.toISOString(),
    status: request.status,
    reason: request.reason,
    details: parsedDetails,
    resolvedAt: request.resolvedAt ? request.resolvedAt.toISOString() : null,
  };
}

function formatBasPeriod(start: Date, end: Date): string {
  const year = start.getUTCFullYear();
  const quarter = Math.floor(start.getUTCMonth() / 3) + 1;
  return `${year} Q${quarter}`;
}

async function ensureSuspiciousTaxGapAlert(
  orgId: string,
  paygwShortfall: number,
  gstShortfall: number,
): Promise<void> {
  const flags: string[] = [];
  if (paygwShortfall > SHORTFALL_ALERT_THRESHOLD) {
    flags.push(`PAYGW shortfall $${paygwShortfall.toFixed(2)}`);
  }
  if (gstShortfall > SHORTFALL_ALERT_THRESHOLD) {
    flags.push(`GST shortfall $${gstShortfall.toFixed(2)}`);
  }

  if (flags.length === 0) {
    return;
  }

  const existing = await prisma.alert.findFirst({
    where: {
      orgId,
      type: "SUSPICIOUS_TAX_GAP",
      severity: "HIGH",
      resolvedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return;
  }

  await prisma.alert.create({
    data: {
      orgId,
      type: "SUSPICIOUS_TAX_GAP",
      severity: "HIGH",
      message: flags.join("; "),
    },
  });

  await recordAuditLog({
    orgId,
    actorId: "system",
    action: "alerts.auto-create",
    metadata: {
      flags,
      threshold: SHORTFALL_ALERT_THRESHOLD,
    },
  });
}

async function loadDesignatedAccountContext(orgId: string): Promise<DesignatedAccountContext> {
  const accounts = await prisma.designatedAccount.findMany({
    where: { orgId },
    orderBy: { type: "asc" },
    include: {
      transfers: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  const shaped: DesignatedAccountView[] = accounts.map(
    (account: DesignatedAccountModel & { transfers: DesignatedTransferModel[] }) => ({
      id: account.id,
      type: account.type.toUpperCase(),
      balance: decimalToNumber(account.balance),
      updatedAt: account.updatedAt.toISOString(),
      transfers: account.transfers.map((transfer) => ({
        id: transfer.id,
        amount: decimalToNumber(transfer.amount),
        source: transfer.source,
        createdAt: transfer.createdAt.toISOString(),
      })),
    })
  );

  const totals = shaped.reduce(
    (acc, account) => {
      if (account.type === "PAYGW") {
        acc.paygw += account.balance;
      } else if (account.type === "GST") {
        acc.gst += account.balance;
      }
      return acc;
    },
    { paygw: 0, gst: 0 }
  );

  return { accounts: shaped, totals };
}

async function syncBasCycleSecured(
  cycle: BasCycleModel,
  balances: { paygw: number; gst: number }
): Promise<BasCycleModel> {
  const paygwRequired = decimalToNumber(cycle.paygwRequired);
  const gstRequired = decimalToNumber(cycle.gstRequired);
  const paygwShortfall = Math.max(0, paygwRequired - balances.paygw);
  const gstShortfall = Math.max(0, gstRequired - balances.gst);

  await ensureSuspiciousTaxGapAlert(
    cycle.orgId,
    paygwShortfall,
    gstShortfall,
  );

  const paygwStatus = paygwShortfall <= 0 ? "READY" : "BLOCKED";
  const gstStatus = gstShortfall <= 0 ? "READY" : "BLOCKED";
  const overallStatus =
    paygwStatus === "READY" && gstStatus === "READY" ? "READY" : "BLOCKED";

  const currentPaygw = decimalToNumber(cycle.paygwSecured);
  const currentGst = decimalToNumber(cycle.gstSecured);
  const shouldUpdate =
    Math.abs(currentPaygw - balances.paygw) > 0.01 ||
    Math.abs(currentGst - balances.gst) > 0.01 ||
    cycle.overallStatus !== overallStatus;

  if (!shouldUpdate) {
    return cycle;
  }

  return prisma.basCycle.update({
    where: { id: cycle.id },
    data: {
      paygwSecured: balances.paygw,
      gstSecured: balances.gst,
      overallStatus,
    },
  });
}

async function compileComplianceReport(orgId: string): Promise<ComplianceReportPayload> {
  const [basCycles, alerts, planRequests, designatedContext] = await Promise.all([
    prisma.basCycle.findMany({
      where: { orgId },
      orderBy: { periodStart: "desc" },
      take: 8,
    }),
    prisma.alert.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.paymentPlanRequest.findMany({
      where: { orgId },
      orderBy: { requestedAt: "desc" },
    }),
    loadDesignatedAccountContext(orgId),
  ]);

  const activeIndex = basCycles.findIndex((cycle) => cycle.lodgedAt === null);
  if (activeIndex >= 0) {
    basCycles[activeIndex] = await syncBasCycleSecured(
      basCycles[activeIndex],
      designatedContext.totals
    );
  }

  const activeCycle = activeIndex >= 0 ? basCycles[activeIndex] : null;

  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);

  return {
    orgId,
    basHistory: basCycles.map((cycle) => {
      const periodLabel = formatBasPeriod(cycle.periodStart, cycle.periodEnd);
      const paygwReady =
        decimalToNumber(cycle.paygwSecured) >= decimalToNumber(cycle.paygwRequired);
      const gstReady =
        decimalToNumber(cycle.gstSecured) >= decimalToNumber(cycle.gstRequired);
      const readinessNote = [
        `PAYGW ${paygwReady ? "secured" : "short"}`,
        `GST ${gstReady ? "secured" : "short"}`,
      ].join("; ");

      return {
        period: periodLabel,
        lodgedAt: cycle.lodgedAt?.toISOString() ?? null,
        status:
          cycle.overallStatus === "LODGED"
            ? "ON_TIME"
            : cycle.overallStatus.toUpperCase(),
        notes: readinessNote,
      };
    }),
    paymentPlans: planRequests.map((plan) => shapePaymentPlan(plan)),
    alertsSummary: {
      openHighSeverity: alerts.filter(
        (alert) => alert.severity === "HIGH" && !alert.resolvedAt
      ).length,
      resolvedThisQuarter: alerts.filter(
        (alert) => alert.resolvedAt && alert.resolvedAt >= quarterStart
      ).length,
    },
    nextBasDue: activeCycle?.periodEnd.toISOString() ?? null,
    designatedTotals: designatedContext.totals,
  };
}

async function createMonitoringSnapshot(orgId: string): Promise<MonitoringSnapshotModel> {
  return metrics.observeJob("monitoring.snapshot.create", async () => {
    const now = new Date();

    const [alerts, designatedContext, activeCycle, openPlanCount] = await Promise.all([
      prisma.alert.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      loadDesignatedAccountContext(orgId),
      prisma.basCycle.findFirst({
        where: { orgId, lodgedAt: null },
        orderBy: { periodEnd: "desc" },
      }),
      prisma.paymentPlanRequest.count({
        where: { orgId, resolvedAt: null },
      }),
    ]);

    let preview = null as ReturnType<typeof shapeBasPreview> | null;
    if (activeCycle) {
      const synced = await syncBasCycleSecured(activeCycle, designatedContext.totals);
      preview = shapeBasPreview(synced, designatedContext.totals);
    }

    const payload = {
      generatedAt: now.toISOString(),
      alerts: {
        total: alerts.length,
        openHigh: alerts.filter((alert) => !alert.resolvedAt && alert.severity === "HIGH").length,
        openMedium: alerts.filter((alert) => !alert.resolvedAt && alert.severity === "MEDIUM").length,
        recent: alerts.slice(0, 10).map((alert) => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          createdAt: alert.createdAt.toISOString(),
          resolved: Boolean(alert.resolvedAt),
        })),
      },
      paymentPlansOpen: openPlanCount,
      designatedTotals: designatedContext.totals,
      bas: preview
        ? {
            overallStatus: preview.overallStatus,
            paygw: preview.paygw,
            gst: preview.gst,
            blockers: preview.blockers,
          }
        : null,
    };

    return prisma.monitoringSnapshot.create({
      data: {
        orgId,
        type: "compliance",
        payload,
      },
    });
  });
}

async function registerRegulatorRoutes(app: FastifyInstance): Promise<void> {
  const regulatorContext = (request: FastifyRequest) => {
    const claims: any = (request as any).user ?? {};
    const session = (request as any).regulatorSession;
    const orgId = session?.orgId ?? claims.orgId;
    const actorId = `regulator:${claims.sessionId ?? session?.id ?? claims.sub ?? "unknown"}`;
    return { orgId, actorId, sessionId: session?.id ?? claims.sessionId ?? claims.sub ?? "unknown" };
  };

  app.get("/evidence", async (request, reply) => {
    const { orgId, actorId } = regulatorContext(request);
    const artifacts = await prisma.evidenceArtifact.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        kind: true,
        sha256: true,
        createdAt: true,
        wormUri: true,
      },
    });

    await recordAuditLog({
      orgId,
      actorId,
      action: "regulator.evidence.list",
      metadata: {},
    });

    reply.send({
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        sha256: artifact.sha256,
        wormUri: artifact.wormUri,
        createdAt: artifact.createdAt.toISOString(),
      })),
    });
  });

  app.get("/evidence/:id", async (request, reply) => {
    const { orgId, actorId } = regulatorContext(request);
    const { id } = request.params as { id: string };

    const artifact = await prisma.evidenceArtifact.findUnique({
      where: { id },
    });

    if (!artifact || artifact.orgId !== orgId) {
      throw notFound("artifact_not_found", "No matching evidence artifact");
    }

    await recordAuditLog({
      orgId,
      actorId,
      action: "regulator.evidence.get",
      metadata: { artifactId: id },
    });

    reply.send({
      artifact: {
        id: artifact.id,
        kind: artifact.kind,
        sha256: artifact.sha256,
        wormUri: artifact.wormUri,
        createdAt: artifact.createdAt.toISOString(),
        payload: artifact.payload ?? null,
      },
    });
  });

  app.get("/evidence/:id/attestation", async (request, reply) => {
    const { orgId, actorId } = regulatorContext(request);
    const { id } = request.params as { id: string };

    const artifact = await prisma.evidenceArtifact.findUnique({
      where: { id },
    });

    if (!artifact || artifact.orgId !== orgId) {
      throw notFound("artifact_not_found", "No matching evidence artifact");
    }

    await recordAuditLog({
      orgId,
      actorId,
      action: "regulator.evidence.attestation",
      metadata: { artifactId: id },
    });

    const attestation = await issueArtifactAttestation(
      app.providers.worm,
      artifact,
    );

    reply.send({ attestation });
  });

  app.get("/compliance/report", async (request, reply) => {
    const { orgId, actorId } = regulatorContext(request);
    const report = await compileComplianceReport(orgId);

    await recordAuditLog({
      orgId,
      actorId,
      action: "regulator.compliance.report",
      metadata: {},
    });

    reply.send(report);
  });

  app.get("/alerts", async (request, reply) => {
    const { orgId, actorId } = regulatorContext(request);
    const alerts = await prisma.alert.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    await recordAuditLog({
      orgId,
      actorId,
      action: "regulator.alerts.list",
      metadata: { count: alerts.length },
    });

    reply.send({
      alerts: alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        createdAt: alert.createdAt.toISOString(),
        resolved: Boolean(alert.resolvedAt),
        resolvedAt: alert.resolvedAt?.toISOString() ?? null,
      })),
    });
  });

  app.get("/monitoring/snapshots", async (request, reply) => {
    const { orgId, actorId } = regulatorContext(request);
    const limitRaw = (request.query as Record<string, string | undefined>)?.limit;
    const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 10;
    const limit = Number.isFinite(limitParsed) ? Math.min(Math.max(limitParsed, 1), 50) : 10;

    const snapshots = await prisma.monitoringSnapshot.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    await recordAuditLog({
      orgId,
      actorId,
      action: "regulator.monitoring.list",
      metadata: { limit },
    });

    reply.send({
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        type: snapshot.type,
        createdAt: snapshot.createdAt.toISOString(),
        payload: snapshot.payload,
      })),
    });
  });

  app.get("/bank-lines/summary", async (request, reply) => {
    const { orgId, actorId } = regulatorContext(request);
    const aggregates = await prisma.bankLine.aggregate({
      where: { orgId },
      _count: { _all: true },
      _sum: { amount: true },
      _min: { date: true },
      _max: { date: true },
    });

    const recent = await prisma.bankLine.findMany({
      where: { orgId },
      orderBy: { date: "desc" },
      take: 5,
      select: {
        id: true,
        date: true,
        amount: true,
      },
    });

    await recordAuditLog({
      orgId,
      actorId,
      action: "regulator.bankLines.summary",
      metadata: { sampleSize: recent.length },
    });

    reply.send({
      summary: {
        totalEntries: aggregates._count?._all ?? 0,
        totalAmount: decimalToNumber(aggregates._sum?.amount ?? 0),
        firstEntryAt: aggregates._min?.date?.toISOString() ?? null,
        lastEntryAt: aggregates._max?.date?.toISOString() ?? null,
      },
      recent: recent.map((line) => ({
        id: line.id,
        date: line.date.toISOString(),
        amount: decimalToNumber(line.amount),
      })),
    });
  });

  app.get("/health", async () => {
    return { ok: true, service: "api-gateway-regulator" };
  });
}

async function buildEvidenceSnapshot(orgId: string) {
  return metrics.observeJob("compliance.evidence.snapshot", async () => {
    const [report, designatedContext, alerts, auditLog, activeCycle, monitoringSnapshots] =
      await Promise.all([
        compileComplianceReport(orgId),
        loadDesignatedAccountContext(orgId),
        prisma.alert.findMany({
          where: { orgId },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
        prisma.auditLog.findMany({
          where: { orgId },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            actorId: true,
            action: true,
            metadata: true,
            createdAt: true,
          },
        }),
        prisma.basCycle.findFirst({
          where: { orgId, lodgedAt: null },
          orderBy: { periodEnd: "desc" },
        }),
        prisma.monitoringSnapshot.findMany({
          where: { orgId },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

    let obligationsPreview: ReturnType<typeof shapeBasPreview> | null = null;
    if (activeCycle) {
      const synced = await syncBasCycleSecured(activeCycle, designatedContext.totals);
      obligationsPreview = shapeBasPreview(synced, designatedContext.totals);
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      orgId,
      complianceReport: report,
      obligationsPreview,
      alerts: alerts.map((alert) => shapeAlert(alert)),
      auditLog: auditLog.map((entry) => ({
        id: entry.id,
        actorId: entry.actorId,
        action: entry.action,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString(),
      })),
      monitoringSnapshots: monitoringSnapshots.map((snapshot) => ({
        id: snapshot.id,
        type: snapshot.type,
        createdAt: snapshot.createdAt.toISOString(),
        payload: snapshot.payload,
      })),
    };

    const jsonPayload = payload as unknown as Prisma.JsonObject;
    const payloadJson = JSON.stringify(jsonPayload);
    const sha256 = crypto.createHash("sha256").update(payloadJson).digest("hex");

    return {
      payload: jsonPayload,
      sha256,
    };
  });
}

attachPrismaMetrics(prisma);

async function issueArtifactAttestation(
  worm: WormProvider,
  artifact: { kind: string; sha256: string; createdAt: Date },
) {
  const scope = resolveScopeForKind(artifact.kind);
  return worm.issueAttestation({
    scope,
    sha256: artifact.sha256,
    createdAt: artifact.createdAt,
    retentionDays: retentionDaysForScope(scope),
  });
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  const allowedOrigins = new Set(config.cors.allowedOrigins);

  const providers = await initProviders(app.log);
  app.decorate("providers", providers);
  app.addHook("onClose", async () => {
    await closeProviders(providers, app.log);
  });

  const drainingState = { value: false };
  app.decorate("isDraining", () => drainingState.value);
  app.decorate("setDraining", (value: boolean) => {
    drainingState.value = value;
  });

  app.addHook("onRequest", (request, reply, done) => {
    const span = trace.getSpan(context.active());
    if (span) {
      const traceId = span.spanContext().traceId;
      if (traceId) {
        request.log = request.log.child({ traceId });
        reply.log = reply.log.child({ traceId });
      }
    }

    const route =
      request.routeOptions?.url ?? request.raw.url ?? "unknown";
    const timer = metrics.httpRequestDuration.startTimer({
      method: request.method,
      route,
    });
    (reply as any).__metrics = {
      timer,
      method: request.method,
      route,
    };
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const metricState = (reply as any).__metrics ?? {};
    const route =
      metricState.route ?? request.routeOptions?.url ?? request.raw.url ?? "unknown";
    const method = metricState.method ?? request.method;
    const status = String(reply.statusCode);

    try {
      metrics.httpRequestTotal.labels(method, route, status).inc();
      if (typeof metricState.timer === "function") {
        metricState.timer({ status });
      } else {
        const end = metrics.httpRequestDuration.startTimer({ method, route });
        end({ status });
      }
    } catch (error) {
      request.log.warn({ err: error }, "failed_to_record_http_metrics");
    } finally {
      (reply as any).__metrics = undefined;
    }
    done();
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply
        .status(error.status)
        .send({ error: { code: error.code, message: error.message, fields: error.fields } });
      return;
    }

    if ((error as any)?.validation) {
      reply.status(400).send({
        error: { code: "invalid_body", message: "Validation failed" },
      });
      return;
    }

    if ((error as any)?.code === "FST_CORS_FORBIDDEN_ORIGIN") {
      reply.status(403).send({
        error: {
          code: "cors_forbidden",
          message: (error as Error).message ?? "Origin not allowed",
        },
      });
      return;
    }

    request.log.error({ err: error }, "Unhandled error");
    reply.status(500).send({
      error: { code: "internal_error", message: "Internal server error" },
    });
  });

  await app.register(rateLimit);
  await app.register(helmet, {
    frameguard: {
      action: "deny",
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'sha256-+Ul8C6HpBvEV0hgFekKPKiEh0Ug3SIn50SjA+iyTNHo='",
        ],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // --- CORS REGISTRATION ---
  // Allow frontend at http://localhost:5173 to call us at http://localhost:3000
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, false);
        return;
      }
      if (allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }
      const error = new Error(`Origin ${origin} is not allowed`);
      cb(Object.assign(error, { code: "FST_CORS_FORBIDDEN_ORIGIN", statusCode: 403 }), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // simple public healthcheck
  app.get("/health", async () => {
    return { ok: true, service: "api-gateway" };
  });

  app.get("/ready", async (_request, reply) => {
    if (app.isDraining()) {
      reply.code(503).send({ ok: false, draining: true });
      return;
    }

    const providerState = app.providers;
    const results: {
      db: boolean;
      redis: boolean | null;
      nats: boolean | null;
      worm: boolean;
    } = {
      db: false,
      redis: providerState.redis ? false : null,
      nats: providerState.nats ? false : null,
      worm: true,
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      results.db = true;
    } catch (error) {
      app.log.error({ err: error }, "readiness_db_check_failed");
      results.db = false;
    }

    if (providerState.redis) {
      try {
        await providerState.redis.ping();
        results.redis = true;
      } catch (error) {
        results.redis = false;
        app.log.error({ err: error }, "readiness_redis_ping_failed");
      }
    }

    if (providerState.nats) {
      try {
        await providerState.nats.flush();
        results.nats = true;
      } catch (error) {
        results.nats = false;
        app.log.error({ err: error }, "readiness_nats_flush_failed");
      }
    }

    const healthy =
      results.db &&
      results.worm &&
      (results.redis !== false) &&
      (results.nats !== false);

    if (!healthy) {
      reply.code(503).send({ ok: false, components: results });
      return;
    }

    reply.send({ ok: true, components: results });
  });

  app.get("/metrics", async (_, reply) => {
    reply.header("content-type", promRegister.contentType);
    reply.send(await promRegister.metrics());
  });

  // /auth/login (public)
  await registerAuthRoutes(app);
  await registerRegulatorAuthRoutes(app);

  const regulatorAuthGuard = createAuthGuard(REGULATOR_AUDIENCE, {
    validate: async (claims, request) => {
      const sessionId = (claims.sessionId ?? claims.sub) as string | undefined;
      if (!sessionId) {
        throw new Error("regulator_session_missing");
      }
      const session = await ensureRegulatorSessionActive(sessionId);
      claims.orgId = session.orgId;
      claims.sessionId = session.id;
      (request as any).regulatorSession = session;
    },
  });

  app.register(
    async (regScope) => {
      regScope.addHook("onRequest", regulatorAuthGuard);
      await registerRegulatorRoutes(regScope);
    },
    { prefix: "/regulator" },
  );

  // ---- Everything below this point requires auth ----

  // GET /users
  app.get(
    "/users",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const users = await prisma.user.findMany({
        where: { orgId },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      const masked = users.map((u) => {
        const [local, domain] = u.email.split("@");
        const safeLocal =
          local.length <= 2 ? local[0] + "*" : local.slice(0, 2) + "*";
        return {
          userId: u.id,
          email: `${safeLocal}@${domain}`,
          createdAt: u.createdAt,
        };
      });

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "users.list",
        metadata: {},
      });

      reply.send({ users: masked });
    }
  );

  // GET /bank-lines
  app.get(
    "/bank-lines",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const lines = await prisma.bankLine.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          date: true,
          amount: true,
          descCiphertext: true,
          createdAt: true,
        },
      });

      const shaped = lines.map((ln) => ({
        id: ln.id,
        postedAt: ln.date,
        amount: Number(ln.amount),
        description: "***",
        createdAt: ln.createdAt,
      }));

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "bankLines.list",
        metadata: {},
      });

      reply.send({ lines: shaped });
    }
  );

  // POST /bank-lines
  app.post(
    "/bank-lines",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const body = parseWithSchema(BankLineCreateSchema, request.body);

      await withIdempotency(
        request,
        reply,
        {
          prisma,
          orgId,
          actorId: userClaims.sub,
          requestPayload: body,
          resource: "bank-line",
        },
        async ({ idempotencyKey }) => {
          const cryptoSafeId = crypto
            .randomUUID()
            .replace(/-/g, "")
            .slice(0, 16);

          const newLine = await prisma.bankLine.create({
            data: {
              id: cryptoSafeId,
              orgId,
              date: new Date(body.date),
              amount: body.amount,
              payeeCiphertext: "***",
              payeeKid: "dev",
              descCiphertext: "***",
              descKid: "dev",
              idempotencyKey,
            },
          });

          await recordAuditLog({
            orgId,
            actorId: userClaims.sub,
            action: "bankLines.create",
            metadata: { lineId: newLine.id },
          });

          return {
            statusCode: 201,
            resourceId: newLine.id,
            body: {
              line: {
                id: newLine.id,
                postedAt: newLine.date.toISOString(),
                amount: Number(newLine.amount),
                description: body.desc,
                createdAt: newLine.createdAt.toISOString(),
              },
            },
          };
        },
      );
    }
  );

  // GET /admin/export/:orgId
  app.get(
    "/admin/export/:orgId",
    { preHandler: authGuard },
    async (request) => {
      const userClaims: any = (request as any).user;
      const params = parseWithSchema(OrgScopedParamsSchema, request.params);
      const { orgId } = params;

      if (orgId !== userClaims.orgId) {
        throw forbidden("forbidden", "Cross-org export denied");
      }

      const org = await prisma.org.findUnique({
        where: { id: orgId },
      });

      const users = await prisma.user.findMany({
        where: { orgId },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      const bankLines = await prisma.bankLine.findMany({
        where: { orgId },
        select: {
          id: true,
          date: true,
          amount: true,
          payeeCiphertext: true,
          descCiphertext: true,
          createdAt: true,
        },
      });

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "admin.export",
        metadata: {},
      });

      return {
        export: {
          org,
          users: users.map((u) => ({
            id: u.id,
            email: u.email,
            createdAt: u.createdAt,
          })),
          bankLines: bankLines.map((b) => ({
            id: b.id,
            date: b.date,
            amount: Number(b.amount),
            payee: b.payeeCiphertext,
            desc: b.descCiphertext,
            createdAt: b.createdAt,
          })),
        },
      };
    }
  );

  app.get(
    "/org/obligations/current",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const designatedContext = await loadDesignatedAccountContext(orgId);

      let cycle = await prisma.basCycle.findFirst({
        where: { orgId, lodgedAt: null },
        orderBy: { periodEnd: "desc" },
      });

      if (cycle) {
        cycle = await syncBasCycleSecured(cycle, designatedContext.totals);
      }

      const preview = shapeBasPreview(cycle, designatedContext.totals);
      const response = preview
        ? {
            basCycleId: preview.id,
            basPeriodStart: preview.periodStart,
            basPeriodEnd: preview.periodEnd,
            paygw: {
              required: preview.paygw.required,
              secured: preview.paygw.secured,
              shortfall: preview.paygw.shortfall,
              status:
                preview.paygw.shortfall > 0 ? "SHORTFALL" : preview.paygw.status,
            },
            gst: {
              required: preview.gst.required,
              secured: preview.gst.secured,
              shortfall: preview.gst.shortfall,
              status:
                preview.gst.shortfall > 0 ? "SHORTFALL" : preview.gst.status,
            },
            nextBasDue: preview.periodEnd,
          }
        : {
            basCycleId: null,
            basPeriodStart: null,
            basPeriodEnd: null,
            paygw: {
              required: 0,
              secured: 0,
              shortfall: 0,
              status: "READY",
            },
            gst: {
              required: 0,
              secured: 0,
              shortfall: 0,
              status: "READY",
            },
            nextBasDue: null,
          };

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "org.obligations.current",
        metadata: {},
      });

      reply.send(response);
    }
  );

  app.get(
    "/org/designated-accounts",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const context = await loadDesignatedAccountContext(orgId);

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "org.designatedAccounts.list",
        metadata: {},
      });

      reply.send({
        accounts: context.accounts,
        totals: context.totals,
      });
    }
  );

  app.get(
    "/feeds/payroll",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const data = {
        runs: [
          {
            id: "run-2025-10-15",
            date: "2025-10-15",
            grossWages: 45000,
            paygwCalculated: 8200,
            paygwSecured: 8000,
            status: "PARTIAL",
          },
        ],
      };

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "feeds.payroll.list",
        metadata: {},
      });

      reply.send(data);
    }
  );

  app.get(
    "/feeds/gst",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const data = {
        days: [
          {
            date: "2025-10-15",
            salesTotal: 12000,
            gstCalculated: 1090,
            gstSecured: 1090,
            status: "OK",
          },
          {
            date: "2025-10-16",
            salesTotal: 9000,
            gstCalculated: 818,
            gstSecured: 600,
            status: "SHORT",
          },
        ],
      };

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "feeds.gst.list",
        metadata: {},
      });

      reply.send(data);
    }
  );

  app.get(
    "/alerts",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const alerts = await prisma.alert.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
      });

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "alerts.list",
        metadata: {},
      });

      reply.send({
        alerts: alerts.map((alert) => shapeAlert(alert)),
      });
    }
  );

  app.post(
    "/alerts/:id/resolve",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;
      const params = parseWithSchema(AlertResolveParamsSchema, request.params);
      const body = parseWithSchema(AlertResolveBodySchema, request.body);

      await withIdempotency(
        request,
        reply,
        {
          prisma,
          orgId,
          actorId: userClaims.sub,
          requestPayload: { params, body },
          resource: "alert",
        },
        async () => {
          const { id } = params;

          const alert = await prisma.alert.findUnique({
            where: { id },
          });

          if (!alert || alert.orgId !== orgId) {
            throw notFound("alert_not_found", "No such alert");
          }

          const userRecord = await prisma.user.findUnique({
            where: { id: userClaims.sub },
            select: { id: true, orgId: true, mfaEnabled: true },
          });

          if (!userRecord || userRecord.orgId !== orgId) {
            throw forbidden("forbidden", "User scope mismatch");
          }

          if (alert.resolvedAt) {
            throw conflict("already_resolved", "Alert already resolved");
          }

          const requiresMfa =
            userRecord.mfaEnabled && alert.severity.toUpperCase() === "HIGH";
          let verification: VerifyChallengeResult | null = null;
          let verified = !requiresMfa ? true : requireRecentVerification(userRecord.id);

          if (requiresMfa && !verified) {
            const trimmed = body.mfaCode;
            if (trimmed) {
              verification = await verifyChallenge(userRecord.id, trimmed);
              verified = verification.success;
            }
          }

          if (requiresMfa && !verified) {
            throw unauthorized(
              "mfa_required",
              "Valid MFA verification required to resolve high-severity alerts",
            );
          }

          const resolved = await prisma.alert.update({
            where: { id },
            data: {
              resolvedAt: new Date(),
              resolutionNote: body.note,
            },
          });

          await recordAuditLog({
            orgId,
            actorId: userClaims.sub,
            action: "alert.resolve",
            metadata: {
              alertId: id,
              mfaRequired: requiresMfa,
              mfaMethod: requiresMfa
                ? verification?.method ??
                  (requireRecentVerification(userRecord.id) ? "session" : undefined)
                : undefined,
              recoveryCodesRemaining: verification?.remainingRecoveryCodes,
            },
          });

          return {
            statusCode: 200,
            resourceId: resolved.id,
            body: { alert: shapeAlert(resolved) },
          };
        },
      );
    }
  );

  app.get(
    "/bas/preview",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const context = await loadDesignatedAccountContext(orgId);

      let cycle = await prisma.basCycle.findFirst({
        where: { orgId, lodgedAt: null },
        orderBy: { periodEnd: "desc" },
      });

      if (cycle) {
        cycle = await syncBasCycleSecured(cycle, context.totals);
      }

      const preview = shapeBasPreview(cycle, context.totals);
      const payload = preview
        ? {
            basCycleId: preview.id,
            periodStart: preview.periodStart,
            periodEnd: preview.periodEnd,
            paygw: {
              required: preview.paygw.required,
              secured: preview.paygw.secured,
              status: preview.paygw.status,
            },
            gst: {
              required: preview.gst.required,
              secured: preview.gst.secured,
              status: preview.gst.status,
            },
            overallStatus: preview.overallStatus,
            blockers: preview.blockers,
          }
        : {
            basCycleId: null,
            periodStart: null,
            periodEnd: null,
            paygw: { required: 0, secured: 0, status: "READY" },
            gst: { required: 0, secured: 0, status: "READY" },
            overallStatus: "READY",
            blockers: [],
          };

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "bas.preview",
        metadata: {},
      });

      reply.send(payload);
    }
  );

  app.get(
    "/bas/payment-plan-request",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;
      const { basCycleId } = parseWithSchema(BasPaymentPlanQuerySchema, request.query);

      let targetCycleId = basCycleId ?? null;

      if (!targetCycleId) {
        const active = await prisma.basCycle.findFirst({
          where: { orgId, lodgedAt: null },
          orderBy: { periodEnd: "desc" },
        });
        targetCycleId = active?.id ?? null;
      }

      if (!targetCycleId) {
        reply.send({ request: null });
        return;
      }

      const plan = await prisma.paymentPlanRequest.findFirst({
        where: { orgId, basCycleId: targetCycleId },
        orderBy: { requestedAt: "desc" },
      });

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "bas.paymentPlan.view",
        metadata: { basCycleId: targetCycleId },
      });

      reply.send({
        request: plan ? shapePaymentPlan(plan) : null,
      });
    }
  );

    app.post(
      "/bas/lodge",
      { preHandler: authGuard },
      async (request, reply) => {
        const userClaims: any = (request as any).user;
        const orgId = userClaims.orgId;
        const body = parseWithSchema(BasLodgeBodySchema, request.body);

        await withIdempotency(
          request,
          reply,
          {
            prisma,
            orgId,
            actorId: userClaims.sub,
            requestPayload: body,
            resource: "bas-cycle",
          },
          async () => {
            const userRecord = await prisma.user.findUnique({
              where: { id: userClaims.sub },
              select: { id: true, orgId: true, mfaEnabled: true },
            });

            if (!userRecord || userRecord.orgId !== orgId) {
              throw forbidden("forbidden", "User scope mismatch");
            }

            const requiresMfa = userRecord.mfaEnabled;
            let verification: VerifyChallengeResult | null = null;
            let verified = !requiresMfa || requireRecentVerification(userRecord.id);

            if (requiresMfa && !verified) {
              const trimmed = body?.mfaCode;
              if (trimmed) {
                verification = await verifyChallenge(userRecord.id, trimmed);
                verified = verification.success;
              }
            }

            if (requiresMfa && !verified) {
              throw unauthorized("mfa_required", "MFA verification required before lodgment");
            }

            const context = await loadDesignatedAccountContext(orgId);

            let cycle = await prisma.basCycle.findFirst({
              where: { orgId, lodgedAt: null },
              orderBy: { periodEnd: "desc" },
            });

            if (!cycle) {
              throw notFound("bas_cycle_not_found", "No active BAS cycle");
            }

            cycle = await syncBasCycleSecured(cycle, context.totals);
            const preview = shapeBasPreview(cycle, context.totals);
            if (!preview || preview.overallStatus !== "READY") {
              throw conflict("bas_cycle_blocked", "BAS cycle not ready for lodgment");
            }

            const lodgmentTime = new Date();
            const updated = await prisma.basCycle.update({
              where: { id: cycle.id },
              data: {
                overallStatus: "LODGED",
                lodgedAt: lodgmentTime,
              },
            });

            await recordAuditLog({
              orgId,
              actorId: userClaims.sub,
              action: "bas.lodge",
              metadata: {
                basCycleId: updated.id,
                mfaRequired: requiresMfa,
                mfaMethod: requiresMfa
                  ? verification?.method ??
                    (requireRecentVerification(userRecord.id) ? "session" : undefined)
                  : undefined,
                recoveryCodesRemaining: verification?.remainingRecoveryCodes,
              },
            });

            return {
              statusCode: 200,
              resource: "bas-cycle",
              resourceId: updated.id,
              body: {
                basCycle: {
                  id: updated.id,
                  status: updated.overallStatus,
                  lodgedAt: updated.lodgedAt?.toISOString() ?? lodgmentTime.toISOString(),
                },
              },
            };
          },
        );
      }
    );

    app.post(
      "/bas/payment-plan-request",
      { preHandler: authGuard },
      async (request, reply) => {
        const userClaims: any = (request as any).user;
        const orgId = userClaims.orgId;
        const body = parseWithSchema(BasPaymentPlanBodySchema, request.body);

        await withIdempotency(
          request,
          reply,
          {
            prisma,
            orgId,
            actorId: userClaims.sub,
            requestPayload: body,
            resource: "payment-plan-request",
          },
          async () => {
            const cycle = await prisma.basCycle.findUnique({
              where: { id: body.basCycleId },
            });

            if (!cycle || cycle.orgId !== orgId) {
              throw notFound("bas_cycle_not_found", "No matching BAS cycle");
            }

            const existing = await prisma.paymentPlanRequest.findFirst({
              where: {
                orgId,
                basCycleId: body.basCycleId,
                resolvedAt: null,
              },
            });

            if (existing) {
              throw conflict(
                "plan_exists",
                "A payment plan request already exists for this BAS cycle",
              );
            }

            const created = await prisma.paymentPlanRequest.create({
              data: {
                orgId,
                basCycleId: body.basCycleId,
                reason: body.reason,
                status: "SUBMITTED",
                detailsJson: {
                  weeklyAmount: body.weeklyAmount,
                  startDate: body.startDate,
                  notes: body.notes ?? null,
                },
              },
            });

            await recordAuditLog({
              orgId,
              actorId: userClaims.sub,
              action: "bas.paymentPlan.requested",
              metadata: { basCycleId: body.basCycleId },
            });

            return {
              statusCode: 201,
              resource: "payment-plan-request",
              resourceId: created.id,
              body: { request: shapePaymentPlan(created) },
            };
          },
        );
      }
    );

  app.get(
    "/compliance/report",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;
      const complianceReport = await compileComplianceReport(orgId);

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "compliance.report",
        metadata: {},
      });

      reply.send(complianceReport);
    }
  );

  app.get(
    "/compliance/evidence",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const artifacts = await prisma.evidenceArtifact.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          sha256: true,
          createdAt: true,
          wormUri: true,
        },
      });

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "compliance.evidence.list",
        metadata: {},
      });

      reply.send({
        artifacts: artifacts.map((artifact) => ({
          id: artifact.id,
          kind: artifact.kind,
          sha256: artifact.sha256,
          wormUri: artifact.wormUri,
          createdAt: artifact.createdAt.toISOString(),
        })),
      });
    }
  );

  app.get(
    "/compliance/evidence/:id",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;
      const { id } = parseWithSchema(AlertResolveParamsSchema, request.params);

      const artifact = await prisma.evidenceArtifact.findUnique({
        where: { id },
      });

      if (!artifact || artifact.orgId !== orgId) {
        throw notFound("artifact_not_found", "No matching evidence artifact");
      }

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "compliance.evidence.get",
        metadata: { artifactId: id },
      });

      reply.send({
        artifact: {
          id: artifact.id,
          kind: artifact.kind,
          sha256: artifact.sha256,
          wormUri: artifact.wormUri,
          createdAt: artifact.createdAt.toISOString(),
          payload: artifact.payload ?? null,
        },
      });
    }
  );

  app.get(
    "/compliance/evidence/:id/attestation",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;
      const { id } = parseWithSchema(AlertResolveParamsSchema, request.params);

      const artifact = await prisma.evidenceArtifact.findUnique({
        where: { id },
      });

      if (!artifact || artifact.orgId !== orgId) {
        throw notFound("artifact_not_found", "No matching evidence artifact");
      }

      const attestation = await issueArtifactAttestation(
        app.providers.worm,
        artifact,
      );

      reply.send({ attestation });
    }
  );

    app.post(
      "/compliance/evidence",
      { preHandler: authGuard },
      async (request, reply) => {
        const userClaims: any = (request as any).user;
        const orgId = userClaims.orgId;

        await withIdempotency(
          request,
          reply,
          {
            prisma,
            orgId,
            actorId: userClaims.sub,
            requestPayload: request.body ?? null,
            resource: "evidence-artifact",
          },
          async () => {
            const snapshot = await buildEvidenceSnapshot(orgId);

            const desiredUri = createContentAddressedUri(
              "evidence",
              snapshot.sha256,
            );

            let artifact = await prisma.evidenceArtifact.create({
              data: {
                orgId,
                kind: "compliance-pack",
                wormUri: desiredUri,
                sha256: snapshot.sha256,
                payload: snapshot.payload,
              },
            });

            const attestation = await issueArtifactAttestation(
              app.providers.worm,
              artifact,
            );

            if (attestation.uri !== artifact.wormUri) {
              artifact = await prisma.evidenceArtifact.update({
                where: { id: artifact.id },
                data: { wormUri: attestation.uri },
              });
            }

            await recordAuditLog({
              orgId,
              actorId: userClaims.sub,
              action: "compliance.evidence.create",
              metadata: {
                artifactId: artifact.id,
                sha256: artifact.sha256,
                uri: artifact.wormUri,
                retentionUntil: attestation.retentionUntil,
              },
            });

            return {
              statusCode: 201,
              resource: "evidence-artifact",
              resourceId: artifact.id,
              body: {
                artifact: {
                  id: artifact.id,
                  sha256: artifact.sha256,
                  createdAt: artifact.createdAt.toISOString(),
                  wormUri: artifact.wormUri,
                },
              },
            };
          },
        );
      }
    );

    app.post(
      "/monitoring/snapshots",
      { preHandler: authGuard },
      async (request, reply) => {
        const userClaims: any = (request as any).user;
        const orgId = userClaims.orgId;

        await withIdempotency(
          request,
          reply,
          {
            prisma,
            orgId,
            actorId: userClaims.sub,
            requestPayload: request.body ?? null,
            resource: "monitoring-snapshot",
          },
          async () => {
            const snapshot = await createMonitoringSnapshot(orgId);

            await recordAuditLog({
              orgId,
              actorId: userClaims.sub,
              action: "monitoring.snapshot.create",
              metadata: { snapshotId: snapshot.id },
            });

            return {
              statusCode: 201,
              resource: "monitoring-snapshot",
              resourceId: snapshot.id,
              body: {
                snapshot: {
                  id: snapshot.id,
                  type: snapshot.type,
                  payload: snapshot.payload,
                  createdAt: snapshot.createdAt.toISOString(),
                },
              },
            };
          },
        );
      }
    );

  app.get(
    "/monitoring/snapshots",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;
      const limitRaw = (request.query as Record<string, string | undefined>)?.limit;
      const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 10;
      const limit = Number.isFinite(limitParsed) ? Math.min(Math.max(limitParsed, 1), 50) : 10;

      const snapshots = await prisma.monitoringSnapshot.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "monitoring.snapshot.list",
        metadata: { limit },
      });

      reply.send({
        snapshots: snapshots.map((snapshot) => ({
          id: snapshot.id,
          type: snapshot.type,
          payload: snapshot.payload,
          createdAt: snapshot.createdAt.toISOString(),
        })),
      });
    }
  );

  app.get(
    "/security/users",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const users = await prisma.user.findMany({
        where: { orgId },
        select: {
          id: true,
          email: true,
          role: true,
          mfaEnabled: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "security.users.list",
        metadata: {},
      });

      reply.send({
        users: users.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
          createdAt: user.createdAt.toISOString(),
          lastLogin: user.createdAt.toISOString(),
        })),
      });
    }
  );

  return app;
}
