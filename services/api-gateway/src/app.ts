import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import crypto from "node:crypto";
import { context, trace } from "@opentelemetry/api";

import { AppError, badRequest, conflict, forbidden, notFound, unauthorized } from "@apgms/shared";
import { config } from "./config.js";

import rateLimit from "./plugins/rate-limit.js";
import { authGuard, createAuthGuard, REGULATOR_AUDIENCE } from "./auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerRegulatorAuthRoutes } from "./routes/regulator-auth.js";
import { registerBankLinesRoutes } from "./routes/bank-lines.js";
import { prisma } from "./db.js";
import { parseWithSchema } from "./lib/validation.js";
import { verifyChallenge, requireRecentVerification, type VerifyChallengeResult } from "./security/mfa.js";
import { recordAuditLog } from "./lib/audit.js";
import { ensureRegulatorSessionActive } from "./lib/regulator-session.js";
import { metrics, installHttpMetrics, registerMetricsRoute } from "./observability/metrics.js";
import { instrumentPrisma } from "./observability/prisma-metrics.js";
import { closeProviders, initProviders } from "./providers.js";

// ---- keep your other domain code (types, helpers, shapes) exactly as you had ----
// (omitted here for brevity — unchanged from your last working content)

// IMPORTANT: ensure prisma instrumentation remains
instrumentPrisma(prisma as any);

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  installHttpMetrics(app);

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
      const appError = error as AppError;
      reply.status(appError.status).send({ error: { code: appError.code, message: appError.message, fields: appError.fields } });
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
      reply.code(503).send({ ok: false, components: results });
      return;
    }

    reply.send({ ok: true, components: results });
  });

  registerMetricsRoute(app);

  await registerAuthRoutes(app);
  await registerRegulatorAuthRoutes(app);

  await app.register(async (secureScope) => {
    secureScope.addHook("onRequest", authGuard);
    await secureScope.register(registerBankLinesRoutes);
  });

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

  // register the rest of your routes (unchanged), e.g.:
  // await registerAdminDataRoutes(app);
  // await registerTaxRoutes(app);
  // ... plus all your existing routes already in this file.

  return app;
}

