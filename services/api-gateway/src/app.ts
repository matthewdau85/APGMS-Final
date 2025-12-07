import Fastify, { FastifyInstance, FastifyPluginAsync } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { context, trace } from "@opentelemetry/api";
import "dotenv/config.js";

import rateLimit from "./plugins/rate-limit.js";
import { config } from "./config.js";

import { AppError } from "@apgms/shared";
import { ERROR_MESSAGES } from "./lib/errors.js";

import {
  authGuard,
  createAuthGuard,
  REGULATOR_AUDIENCE,
} from "./auth.js";

import { prisma } from "./db.js";
import { initProviders, closeProviders } from "./providers.js";

// Core routes
import { registerAuthRoutes } from "./routes/auth.js";
import { registerRegulatorAuthRoutes } from "./routes/regulator-auth.js";
import { registerRegulatorRoutes } from "./routes/regulator.js";
import { registerAdminDataRoutes } from "./routes/admin.data.js";
import { registerBankLinesRoutes } from "./routes/bank-lines.js";
import { registerTaxRoutes } from "./routes/tax.js";
import { registerIntegrationEventRoutes } from "./routes/integration-events.js";
import { registerBasRoutes } from "./routes/bas.js";
import { registerTransferRoutes } from "./routes/transfers.js";
import { registerPaymentPlanRoutes } from "./routes/payment-plans.js";
import { registerAtoRoutes } from "./routes/ato.js";
import { registerMonitoringRoutes } from "./routes/monitoring.js";
import { registerRiskRoutes } from "./routes/risk.js";
import { registerDemoRoutes } from "./routes/demo.js";
import { registerComplianceMonitorRoutes } from "./routes/compliance-monitor.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerForecastRoutes } from "./routes/forecast.js";
import { registerComplianceProxy } from "./routes/compliance-proxy.js";
import registerConnectorRoutes from "./routes/connectors.js";

// Observability
import {
  metrics,
  installHttpMetrics,
  registerMetricsRoute,
} from "./observability/metrics.js";
import { helmetConfigFor } from "./security-headers.js";

// Domain-led routes you added
import { basSettlementRoutes } from "./routes/bas-settlement.js";
import { exportRoutes } from "./routes/export.js";
import { csvIngestRoutes } from "./routes/ingest-csv.js";

import { ensureRegulatorSessionActive } from "./lib/regulator-session.js";

type BuildServerOptions = {
  bankLinesPlugin?: FastifyPluginAsync;
};

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  installHttpMetrics(app);

  /** Provider lifecycle */
  const providers = await initProviders(app.log);
  (app as any).providers = providers;
  app.addHook("onClose", async () => {
    await closeProviders(providers, app.log);
  });

  /** Server draining state for graceful shutdown */
  const drainingState = { value: false };
  (app as any).isDraining = () => drainingState.value;
  (app as any).setDraining = (v: boolean) => (drainingState.value = v);

  /** Telemetry correlation */
  app.addHook("onRequest", (request, reply, done) => {
    const span = trace.getSpan(context.active());
    if (span) {
      const traceId = span.spanContext().traceId;
      if (traceId) {
        request.log = request.log.child({ traceId });
        reply.log = reply.log.child({ traceId });
      }
    }

    const route = request.routeOptions?.url ?? request.raw.url ?? "unknown";
    const timer = metrics.httpRequestDuration.startTimer({
      method: request.method,
      route,
    });
    (reply as any).__metrics = { timer, method: request.method, route };
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const metricState = (reply as any).__metrics ?? {};
    const route =
      metricState.route ??
      request.routeOptions?.url ??
      request.raw.url ??
      "unknown";
    const method = metricState.method ?? request.method;
    const status = String(reply.statusCode);

    try {
      metrics.httpRequestTotal.labels(method, route, status).inc();
      if (typeof metricState.timer === "function") {
        metricState.timer({ status });
      }
    } catch (err) {
      request.log.warn({ err }, "metrics_record_failed");
    } finally {
      (reply as any).__metrics = undefined;
    }
    done();
  });

  /** Error Handler */
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.status).send({
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields,
        },
      });
      return;
    }

    if ((error as any)?.validation) {
      reply.status(400).send({ error: { code: "invalid_body" } });
      return;
    }

    if ((error as any)?.code === "FST_CORS_FORBIDDEN_ORIGIN") {
      reply.status(403).send({
        error: { code: "cors_forbidden", message: ERROR_MESSAGES.cors_forbidden },
      });
      return;
    }

    request.log.error({ err: error }, "unhandled_error");
    reply.status(500).send({
      error: { code: "internal_error", message: ERROR_MESSAGES.internal_error },
    });
  });

  /** Core security + rate limiting */
  await app.register(rateLimit);
  await app.register(helmet, helmetConfigFor(config));

  /** CORS restrict to known origins per config */
  const allowedOrigins = new Set(config.cors.allowedOrigins);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, false);
      if (allowedOrigins.has(origin)) return cb(null, true);
      cb(Object.assign(new Error(`Origin ${origin} is not allowed`), {
        code: "FST_CORS_FORBIDDEN_ORIGIN",
        statusCode: 403,
      }), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    exposedHeaders: ["Idempotent-Replay"],
  });

  /** Basic endpoints */
  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/ready", async (_request, reply) => {
    if ((app as any).isDraining()) {
      reply.code(503).send({ ok: false, draining: true });
      return;
    }

    const providerState = (app as any).providers ?? {};
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      reply.code(503).send({ ok: false, db: false });
      return;
    }

    reply.send({ ok: true });
  });

  registerMetricsRoute(app);

  /** Public auth routes */
  await registerAuthRoutes(app);
  await registerRegulatorAuthRoutes(app);

  /**
   * Authenticated customer/admin routes
   */
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

    await secureScope.register(registerOnboardingRoutes);
    await secureScope.register(registerForecastRoutes);

    await registerComplianceProxy(app, {} as any);

    await secureScope.register(registerConnectorRoutes);

    // 🆕 secureLedger/payto/BAS/export/csv ingestion
    secureScope.register(basSettlementRoutes, { prefix: "/api" });
    secureScope.register(exportRoutes, { prefix: "/api" });
    secureScope.register(csvIngestRoutes, { prefix: "/api/ingest/csv" });
  });

  /**
   * Regulator routes (separate auth requirement)
   */
  const regulatorAuthGuard = createAuthGuard(REGULATOR_AUDIENCE, {
    validate: async (principal, request) => {
      const sessionId = (principal.sessionId ?? principal.id) as string;
      const session = await ensureRegulatorSessionActive(sessionId);
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

  return app;
}

export async function createApp(
  options: BuildServerOptions = {},
): Promise<FastifyInstance> {
  return buildServer(options);
}
