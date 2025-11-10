import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import crypto from "node:crypto";
import { context, trace } from "@opentelemetry/api";

import { AppError, badRequest, conflict, forbidden, notFound, unauthorized } from "./shared-shims.js";
import { config } from "./config.js";

import rateLimit from "./plugins/rate-limit.js";
import { authGuard, createAuthGuard, REGULATOR_AUDIENCE } from "./auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerRegulatorAuthRoutes } from "./routes/regulator-auth.js";
import { prisma } from "./db.js";
import { createMlClient, type MlRiskClient, type RiskAssessment } from "./clients/ml-service.js";
import { parseWithSchema } from "./lib/validation.js";
import { verifyChallenge, requireRecentVerification, type VerifyChallengeResult } from "./security/mfa.js";
import { recordAuditLog } from "./lib/audit.js";
import { ensureRegulatorSessionActive } from "./lib/regulator-session.js";
import { withIdempotency } from "./lib/idempotency.js";
import { metrics, installHttpMetrics, registerMetricsRoute } from "./observability/metrics.js";
import { instrumentPrisma } from "./observability/prisma-metrics.js";
import { closeProviders, initProviders } from "./providers.js";
import { registerRiskRoutes } from "./routes/risk.js";

// ---- keep your other domain code (types, helpers, shapes) exactly as you had ----
// (omitted here for brevity — unchanged from your last working content)

// IMPORTANT: ensure prisma instrumentation remains
instrumentPrisma(prisma as any);

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  installHttpMetrics(app);

  (app as any).config = config;
  const mlClient = createMlClient(config.mlServiceUrl);
  (app as any).mlClient = mlClient as MlRiskClient;

  const allowedOrigins = new Set(config.cors.allowedOrigins);

  const providers = await initProviders(app.log);
  (app as any).providers = providers;
  app.addHook("onClose", async () => {
    await closeProviders(providers, app.log);
  });

  const drainingState = { value: false };
  (app as any).isDraining = () => drainingState.value;
  (app as any).setDraining = (v: boolean) => { drainingState.value = v; };

  app.addHook("onRequest", (request, reply, done) => {
    const span = trace.getSpan(context.active());
    if (span) {
      const traceId = span.spanContext().traceId;
      if (traceId) {
        request.log = request.log.child({ traceId });
        reply.log = reply.log.child({ traceId });
      }
    }

    const route = (request.routeOptions?.url ?? request.raw.url ?? "unknown");
    const timer = metrics.httpRequestDuration.startTimer({ method: request.method, route });
    (reply as any).__metrics = { timer, method: request.method, route };
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const metricState = (reply as any).__metrics ?? {};
    const route = metricState.route ?? request.routeOptions?.url ?? request.raw.url ?? "unknown";
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
      reply.status((error as any).status).send({ error: { code: error.code, message: error.message, fields: error.fields } });
      return;
    }
    if ((error as any)?.validation) {
      reply.status(400).send({ error: { code: "invalid_body", message: "Validation failed" } });
      return;
    }
    if ((error as any)?.code === "FST_CORS_FORBIDDEN_ORIGIN") {
      reply.status(403).send({ error: { code: "cors_forbidden", message: (error as Error).message ?? "Origin not allowed" } });
      return;
    }
    request.log.error({ err: error }, "Unhandled error");
    reply.status(500).send({ error: { code: "internal_error", message: "Internal server error" } });
  });

  await app.register(rateLimit);
  await app.register(helmet, {
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        scriptSrc: ["'self'", "'sha256-+Ul8C6HpBvEV0hgFekKPKiEh0Ug3SIn50SjA+iyTNHo='"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, false);
      if (allowedOrigins.has(origin)) return cb(null, true);
      const error = new Error(`Origin ${origin} is not allowed`);
      cb(Object.assign(error, { code: "FST_CORS_FORBIDDEN_ORIGIN", statusCode: 403 }), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/ready", async (_request, reply) => {
    if ((app as any).isDraining?.() === true) {
      reply.code(503).send({ ok: false, draining: true });
      return;
    }

    const providerState = (app as any).providers ?? {};
    const results: { db: boolean; redis: boolean | null; nats: boolean | null } = {
      db: false,
      redis: providerState.redis ? false : null,
      nats: providerState.nats ? false : null
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

    const healthy = results.db && (results.redis !== false) && (results.nats !== false);
    if (!healthy) {
      reply.code(503).send({ ok: false, ready: false, components: results, blocked: true });
      return;
    }

    const mlRiskClient: MlRiskClient | undefined = (app as any).mlClient;
    let readinessRisk: RiskAssessment | null = null;
    if (mlRiskClient) {
      try {
        const latestBas = await prisma.basCycle.findFirst({ orderBy: { periodEnd: "desc" } });
        const now = new Date();
        const paygwRequired = Number(latestBas?.paygwRequired ?? 0);
        const paygwSecured = Number(latestBas?.paygwSecured ?? 0);
        const gstRequired = Number(latestBas?.gstRequired ?? 0);
        const gstSecured = Number(latestBas?.gstSecured ?? 0);
        const totalRequired = paygwRequired + gstRequired;
        const totalSecured = paygwSecured + gstSecured;
        const liquidityCoverage = totalRequired > 0 ? totalSecured / totalRequired : 1;
        const escrowCoverage = paygwRequired > 0 ? paygwSecured / paygwRequired : liquidityCoverage;
        const basWindowDays = latestBas && latestBas.periodEnd > now
          ? Math.max(0, Math.round((latestBas.periodEnd.getTime() - now.getTime()) / 86400000))
          : 0;
        const outstandingAlerts = latestBas
          ? await prisma.alert.count({ where: { orgId: latestBas.orgId, resolvedAt: null } })
          : 0;
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const recentShortfalls = latestBas
          ? await prisma.basCycle.count({
              where: {
                orgId: latestBas.orgId,
                periodEnd: { gte: ninetyDaysAgo },
                overallStatus: { not: "READY" },
              },
            })
          : 0;

        readinessRisk = await mlRiskClient.evaluateShortfall({
          orgId: latestBas?.orgId ?? "unknown",
          liquidityCoverage,
          escrowCoverage,
          outstandingAlerts,
          basWindowDays,
          recentShortfalls,
        });
      } catch (error) {
        app.log.error({ err: error }, "ml_shortfall_readiness_failed");
      }
    }

    if (readinessRisk?.riskLevel === "high") {
      app.metrics?.recordSecurityEvent?.("readiness.blocked.high_risk");
      reply
        .code(503)
        .send({ ok: false, ready: false, components: results, blocked: true, risk: readinessRisk });
      return;
    }

    const responsePayload: Record<string, unknown> = {
      ok: true,
      ready: true,
      components: results,
      blocked: false,
    };

    if (readinessRisk) {
      responsePayload.risk = readinessRisk;
      if (readinessRisk.riskLevel === "medium") {
        responsePayload.warning = "readiness_risk_medium";
      }
    }

    reply.send(responsePayload);
  });

  registerMetricsRoute(app);

  await registerAuthRoutes(app);
  await registerRegulatorAuthRoutes(app);

  const regulatorAuthGuard = createAuthGuard(REGULATOR_AUDIENCE, {
    validate: async (claims, request) => {
      const sessionId = (claims.sessionId ?? claims.sub) as string | undefined;
      if (!sessionId) throw new Error("regulator_session_missing");
      const session = await ensureRegulatorSessionActive(sessionId);
      (claims as any).orgId = session.orgId;
      (claims as any).sessionId = session.id;
      (request as any).regulatorSession = session;
    }
  });

  app.register(
    async (regScope) => {
      regScope.addHook("onRequest", regulatorAuthGuard);
      // registerRegulatorRoutes(regScope) — keep your existing implementation
    },
    { prefix: "/regulator" }
  );

  await registerRiskRoutes(app);

  // register the rest of your routes (unchanged), e.g.:
  // await registerAdminDataRoutes(app);
  // await registerTaxRoutes(app);
  // ... plus all your existing routes already in this file.

  return app;
}

export async function createApp(): Promise<FastifyInstance> {
  return buildServer();
}

