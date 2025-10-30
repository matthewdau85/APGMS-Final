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
import { register as promRegister, collectDefaultMetrics, Counter } from "prom-client";

// NOTE: make sure config.ts exports what we discussed earlier,
// including cors.allowedOrigins: string[]
import { config } from "./config.js";

import rateLimit from "./plugins/rate-limit.js";
import { authGuard, createAuthGuard, REGULATOR_AUDIENCE } from "./auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerRegulatorAuthRoutes } from "./routes/regulator-auth.js";
import { prisma } from "./db.js";
import { verifyChallenge, requireRecentVerification } from "./security/mfa.js";
import { recordAuditLog } from "./lib/audit.js";
import { ensureRegulatorSessionActive } from "./lib/regulator-session.js";

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

collectDefaultMetrics({ register: promRegister });

const httpRequestCounter = new Counter({
  name: "apgms_api_requests_total",
  help: "Total number of API requests handled by the gateway",
  labelNames: ["method", "route", "status"],
  registers: [promRegister],
});

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
      reply.code(404).send({
        error: { code: "artifact_not_found", message: "No matching evidence artifact" },
      });
      return;
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
  const [report, designatedContext, alerts, auditLog, activeCycle, monitoringSnapshots] = await Promise.all([
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
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  const allowedOrigins = new Set(config.cors.allowedOrigins);

  app.addHook("onResponse", (request, reply, done) => {
    const route =
      (request.routeOptions && request.routeOptions.url) ??
      request.raw.url ??
      "unknown";
    try {
      httpRequestCounter
        .labels(request.method, route, String(reply.statusCode))
        .inc();
    } catch (error) {
      app.log.warn({ err: error }, "failed to record metrics");
    }
    done();
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

  app.get("/ready", async (_, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      reply.send({ ok: true, service: "api-gateway" });
    } catch (error) {
      app.log.error({ err: error }, "readiness check failed");
      reply.code(503).send({ ok: false, service: "api-gateway" });
    }
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

      const body = request.body as {
        date?: string;
        amount?: string;
        payee?: string;
        desc?: string;
      };

      if (
        !body?.date ||
        !body?.amount ||
        !body?.payee ||
        !body?.desc
      ) {
        reply.code(400).send({
          error: {
            code: "invalid_body",
            message: "date, amount, payee, desc are required",
          },
        });
        return;
      }

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
          idempotencyKey: null,
        },
      });

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "bankLines.create",
        metadata: { lineId: newLine.id },
      });

      reply.code(201).send({
        line: {
          id: newLine.id,
          postedAt: newLine.date,
          amount: Number(newLine.amount),
          description: "***",
          createdAt: newLine.createdAt,
        },
      });
    }
  );

  // GET /admin/export/:orgId
  app.get(
    "/admin/export/:orgId",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const { orgId } = request.params as { orgId: string };

      if (orgId !== userClaims.orgId) {
        reply.code(403).send({
          error: { code: "forbidden", message: "Cross-org export denied" },
        });
        return;
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

      reply.send({
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
      });
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
      const { id } = request.params as { id: string };
      const body = request.body as { note?: string; mfaCode?: string } | undefined;

      if (!body?.note || body.note.trim().length === 0) {
        reply.code(400).send({
          error: {
            code: "invalid_body",
            message: "Resolution note is required",
          },
        });
        return;
      }

      const alert = await prisma.alert.findUnique({
        where: { id },
      });

      if (!alert || alert.orgId !== orgId) {
        reply.code(404).send({
          error: { code: "alert_not_found", message: "No such alert" },
        });
        return;
      }

      const userRecord = await prisma.user.findUnique({
        where: { id: userClaims.sub },
        select: { id: true, orgId: true, mfaEnabled: true },
      });

      if (!userRecord || userRecord.orgId !== orgId) {
        reply.code(403).send({
          error: { code: "forbidden", message: "User scope mismatch" },
        });
        return;
      }

      if (alert.resolvedAt) {
        reply.code(409).send({
          error: {
            code: "already_resolved",
            message: "Alert already resolved",
          },
        });
        return;
      }

      const requiresMfa =
        userRecord.mfaEnabled && alert.severity.toUpperCase() === "HIGH";

      if (requiresMfa) {
        let verified = requireRecentVerification(userRecord.id);

        if (!verified) {
          const trimmed = body.mfaCode?.trim();
          if (trimmed && verifyChallenge(userRecord.id, trimmed)) {
            verified = true;
          }
        }

        if (!verified) {
          reply.code(401).send({
            error: {
              code: "mfa_required",
              message: "Valid MFA verification required to resolve high-severity alerts",
            },
          });
          return;
        }
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
        },
      });

      reply.send({ alert: shapeAlert(resolved) });
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
      const { basCycleId } = request.query as { basCycleId?: string };

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
      const body = request.body as { mfaCode?: string } | null;

      const userRecord = await prisma.user.findUnique({
        where: { id: userClaims.sub },
        select: { id: true, orgId: true, mfaEnabled: true },
      });

      if (!userRecord || userRecord.orgId !== orgId) {
        reply.code(403).send({
          error: { code: "forbidden", message: "User scope mismatch" },
        });
        return;
      }

      if (userRecord.mfaEnabled) {
        let verified = requireRecentVerification(userRecord.id);
        if (!verified) {
          const trimmed = body?.mfaCode?.trim();
          if (trimmed && verifyChallenge(userRecord.id, trimmed)) {
            verified = true;
          }
        }

        if (!verified) {
          reply.code(401).send({
            error: {
              code: "mfa_required",
              message: "MFA verification required before lodgment",
            },
          });
          return;
        }
      }

      const context = await loadDesignatedAccountContext(orgId);

      let cycle = await prisma.basCycle.findFirst({
        where: { orgId, lodgedAt: null },
        orderBy: { periodEnd: "desc" },
      });

      if (!cycle) {
        reply.code(404).send({
          error: {
            code: "bas_cycle_not_found",
            message: "No active BAS cycle",
          },
        });
        return;
      }

      cycle = await syncBasCycleSecured(cycle, context.totals);
      const preview = shapeBasPreview(cycle, context.totals);
      if (!preview || preview.overallStatus !== "READY") {
        reply.code(409).send({
          error: {
            code: "bas_cycle_blocked",
            message: "BAS cycle not ready for lodgment",
          },
        });
        return;
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
          mfaRequired: userRecord.mfaEnabled,
        },
      });

      reply.send({
        basCycle: {
          id: updated.id,
          status: updated.overallStatus,
          lodgedAt: updated.lodgedAt?.toISOString() ?? lodgmentTime.toISOString(),
        },
      });
    }
  );

  app.post(
    "/bas/payment-plan-request",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;
      const body = request.body as {
        basCycleId?: string;
        reason?: string;
        weeklyAmount?: number;
        startDate?: string;
        notes?: string;
      } | null;

      if (
        !body?.basCycleId ||
        !body.reason ||
        typeof body.weeklyAmount !== "number" ||
        Number.isNaN(body.weeklyAmount) ||
        !body.startDate
      ) {
        reply.code(400).send({
          error: {
            code: "invalid_body",
            message: "basCycleId, reason, weeklyAmount, and startDate are required",
          },
        });
        return;
      }

      const cycle = await prisma.basCycle.findUnique({
        where: { id: body.basCycleId },
      });

      if (!cycle || cycle.orgId !== orgId) {
        reply.code(404).send({
          error: { code: "bas_cycle_not_found", message: "No matching BAS cycle" },
        });
        return;
      }

      const existing = await prisma.paymentPlanRequest.findFirst({
        where: {
          orgId,
          basCycleId: body.basCycleId,
          resolvedAt: null,
        },
      });

      if (existing) {
        reply.code(409).send({
          error: {
            code: "plan_exists",
            message: "A payment plan request already exists for this BAS cycle",
          },
        });
        return;
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

      reply.code(201).send({ request: shapePaymentPlan(created) });
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
      const { id } = request.params as { id: string };

      const artifact = await prisma.evidenceArtifact.findUnique({
        where: { id },
      });

      if (!artifact || artifact.orgId !== orgId) {
        reply.code(404).send({
          error: { code: "artifact_not_found", message: "No matching evidence artifact" },
        });
        return;
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

  app.post(
    "/compliance/evidence",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const snapshot = await buildEvidenceSnapshot(orgId);

      const artifact = await prisma.$transaction(async (tx) => {
        const created = await tx.evidenceArtifact.create({
          data: {
            orgId,
            kind: "compliance-pack",
            wormUri: "internal:evidence/pending",
            sha256: snapshot.sha256,
            payload: snapshot.payload,
          },
        });
        return tx.evidenceArtifact.update({
          where: { id: created.id },
          data: { wormUri: `internal:evidence/${created.id}` },
        });
      });

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "compliance.evidence.create",
        metadata: { artifactId: artifact.id },
      });

      reply.code(201).send({
        artifact: {
          id: artifact.id,
          sha256: artifact.sha256,
          createdAt: artifact.createdAt.toISOString(),
          wormUri: artifact.wormUri,
        },
      });
    }
  );

  app.post(
    "/monitoring/snapshots",
    { preHandler: authGuard },
    async (request, reply) => {
      const userClaims: any = (request as any).user;
      const orgId = userClaims.orgId;

      const snapshot = await createMonitoringSnapshot(orgId);

      await recordAuditLog({
        orgId,
        actorId: userClaims.sub,
        action: "monitoring.snapshot.create",
        metadata: { snapshotId: snapshot.id },
      });

      reply.code(201).send({
        snapshot: {
          id: snapshot.id,
          type: snapshot.type,
          payload: snapshot.payload,
          createdAt: snapshot.createdAt.toISOString(),
        },
      });
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
