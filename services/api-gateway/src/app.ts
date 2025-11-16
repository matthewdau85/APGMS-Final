import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyReply,
  type FastifyRequest,
  type FastifySchemaValidationError,
} from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import crypto from "node:crypto";
import { context, trace } from "@opentelemetry/api";
import "dotenv/config.js";

import {
  AppError,
  badRequest,
  catalogError,
  conflict,
  forbidden,
  notFound,
  serializeAppError,
  type FieldError,
  unauthorized,
} from "@apgms/shared";
import { config } from "./config.js";

import rateLimit from "./plugins/rate-limit.js";
import { authGuard, createAuthGuard, REGULATOR_AUDIENCE } from "./auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerRegulatorAuthRoutes } from "./routes/regulator-auth.js";
import { registerRegulatorRoutes } from "./routes/regulator.js";
import { registerAdminDataRoutes } from "./routes/admin.data.js";
import { registerBankLinesRoutes } from "./routes/bank-lines.js";
import { registerTaxRoutes } from "./routes/tax.js";
import { registerConnectorRoutes, type ConnectorRoutesDeps } from "./routes/connectors.js";
import { prisma } from "./db.js";
import { parseWithSchema } from "./lib/validation.js";
import { registerBasRoutes } from "./routes/bas.js";
import { registerTransferRoutes } from "./routes/transfers.js";
import { registerIntegrationEventRoutes } from "./routes/integration-events.js";
import { verifyChallenge, requireRecentVerification, type VerifyChallengeResult } from "./security/mfa.js";
import { recordAuditLog } from "./lib/audit.js";
import { ensureRegulatorSessionActive } from "./lib/regulator-session.js";
import { metrics, installHttpMetrics, registerMetricsRoute } from "./observability/metrics.js";
import { closeProviders, initProviders } from "./providers.js";
import { registerPaymentPlanRoutes } from "./routes/payment-plans.js";
import { registerAtoRoutes } from "./routes/ato.js";
import { registerMonitoringRoutes } from "./routes/monitoring.js";
import { registerRiskRoutes } from "./routes/risk.js";
import { registerDemoRoutes } from "./routes/demo.js";
import { registerComplianceProxy } from "./routes/compliance-proxy.js";
import { registerComplianceMonitorRoutes } from "./routes/compliance-monitor.js";

// ---- keep your other domain code (types, helpers, shapes) exactly as you had ----
// (omitted here for brevity - unchanged from your last working content)

type BuildServerOptions = {
  bankLinesPlugin?: FastifyPluginAsync;
  connectorDeps?: ConnectorRoutesDeps;
};

const normalizeInstancePath = (path: string): string => path.replace(/^\//, "").replace(/\//g, ".");

const toFieldErrors = (
  validationErrors: readonly FastifySchemaValidationError[] | undefined,
): FieldError[] => {
  if (!validationErrors || validationErrors.length === 0) {
    return [];
  }
  return validationErrors.map((issue) => {
    const normalizedPath = issue.instancePath ? normalizeInstancePath(issue.instancePath) : "body";
    return {
      path: normalizedPath.length > 0 ? normalizedPath : "body",
      message: issue.message ?? "Invalid value",
    } satisfies FieldError;
  });
};

const sendAppError = (reply: FastifyReply, error: AppError): void => {
  reply.status(error.status).send({ error: serializeAppError(error) });
};

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
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
      sendAppError(reply, error);
      return;
    }
    if ((error as { validation?: FastifySchemaValidationError[] }).validation) {
      const validationErrors = toFieldErrors((error as { validation: FastifySchemaValidationError[] }).validation);
      const cataloged = catalogError("platform.invalid_body", {
        message: "Validation failed",
        fields: validationErrors.length > 0 ? validationErrors : undefined,
      });
      sendAppError(reply, cataloged);
      return;
    }
    if ((error as { code?: string }).code === "FST_CORS_FORBIDDEN_ORIGIN") {
      const corsError = catalogError("platform.cors_forbidden", {
        message: (error as Error).message ?? "Origin not allowed",
      });
      sendAppError(reply, corsError);
      return;
    }
    request.log.error({ err: error }, "unhandled_error");
    const fallback = catalogError("platform.internal_error", {
      message: "Internal server error",
    });
    sendAppError(reply, fallback);
  });

  await app.register(rateLimit);
  await app.register(helmet, {
    hidePoweredBy: true,
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
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true,
    hsts: {
      maxAge: 15552000,
      includeSubDomains: true,
      preload: true,
    },
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, false);
      if (allowedOrigins.has(origin)) return cb(null, true);
      const error = new Error(`Origin ${origin} is not allowed`);
      cb(Object.assign(error, { code: "FST_CORS_FORBIDDEN_ORIGIN", statusCode: 403 }), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    exposedHeaders: ["Idempotent-Replay"],
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
    const bankLinesPlugin = options.bankLinesPlugin ?? registerBankLinesRoutes;
    await secureScope.register(bankLinesPlugin);
    await secureScope.register(registerAdminDataRoutes);
    await secureScope.register(registerTaxRoutes);
    await secureScope.register(registerIntegrationEventRoutes);
    await secureScope.register(registerBasRoutes);
    await secureScope.register(registerTransferRoutes);
    await secureScope.register(registerPaymentPlanRoutes);
    await secureScope.register(registerAtoRoutes);
    await secureScope.register(registerMonitoringRoutes);
    await secureScope.register(registerRiskRoutes);
    await secureScope.register(registerDemoRoutes);
    await secureScope.register(registerComplianceMonitorRoutes);
    await registerComplianceProxy(app);
    await secureScope.register(async (connectorScope) => {
      registerConnectorRoutes(connectorScope, options.connectorDeps);
    });
  });

  const regulatorAuthGuard = createAuthGuard(REGULATOR_AUDIENCE, {
    validate: async (principal, request) => {
      const sessionId = (principal.sessionId ?? principal.id) as string | undefined;
      if (!sessionId) throw new Error("regulator_session_missing");
      const session = await ensureRegulatorSessionActive(sessionId);
      (request as any).regulatorSession = session;
    }
  });

  app.register(
    async (regScope) => {
      regScope.addHook("onRequest", regulatorAuthGuard);
      await registerRegulatorRoutes(regScope);
    },
    { prefix: "/regulator" }
  );


  return app;
}
