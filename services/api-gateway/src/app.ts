// services/api-gateway/src/app.ts

import type { FastifyPluginAsync } from "fastify";

import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";

import {
  installLogging,
  installRequestId,
  installSecurityLog,
} from "./observability/logging.js";
import {
  installOpenTelemetry,
  installTracing,
} from "./observability/tracing.js";
import {
  installMetrics,
  installHttpMetrics,
  registerMetricsRoute,
} from "./observability/metrics.js";
import { helmetConfigFor } from "./security-headers.js";

// Domain-led routes
import { registerBasSettlementRoutes } from "./routes/bas-settlement.js";
import { exportRoutes } from "./routes/export.js";
import { csvIngestRoutes } from "./routes/ingest-csv.js";

import { ensureRegulatorSessionActive } from "./lib/regulator-session.js";
import { installPrisma } from "./observability/prisma-metrics.js";

import {
  AppError,
  badRequest,
  httpError,
  internalError,
  notFound,
  validationError,
} from "./errors.js";

import { configSchema, loadConfig } from "./config.js";
import { installPrismaClient } from "./prisma.js";

import { registerAuthRoutes, createAuthGuard } from "./routes/auth.js";
import { registerBankRoutes } from "./routes/bank-lines.js";
import { registerBasRoutes } from "./routes/bas.js";
import { registerDemoRoutes } from "./routes/demo.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerForecastRoutes } from "./routes/forecast.js";
import { registerRiskRoutes } from "./routes/risk.js";
import { registerTaxRoutes } from "./routes/tax.js";
import { registerComplianceProxyRoutes } from "./routes/compliance-proxy.js";

import { regulatorAuthGuard, registerRegulatorRoutes } from "./routes/regulator.js";

const REGULATOR_AUDIENCE = "apgms-regulator-api";
const REGULATOR_ISSUER = "apgms-regulator-gw";

export const buildServer: FastifyPluginAsync = async (app) => {
  const config = loadConfig();
  app.decorate("config", config);

  // --- Core plumbing & middleware ---
  await installLogging(app);
  await installRequestId(app);
  await installSecurityLog(app);
  await installPrisma(app);
  await installOpenTelemetry(app, config);
  installTracing(app);

  // CORS
  await app.register(fastifyCors, {
    origin: config.corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "content-type",
      "authorization",
      "x-org-id",
      "x-request-id",
      "x-reg-api-key",
      "x-reg-session-id",
      "x-reg-user-id",
    ],
    exposedHeaders: ["x-request-id"],
    credentials: true,
  });

  // Helmet – security headers
  await app.register(fastifyHelmet, helmetConfigFor(config.env));

  // Metrics endpoints and HTTP metrics
  await installMetrics(app);
  await installHttpMetrics(app);
  await registerMetricsRoute(app);

  // Prisma client (DB)
  await installPrismaClient(app);

  // --- Health checks ---
  app.get("/health", async () => ({ ok: true }));

  // --- Public auth routes (login, token, etc.) ---
  await registerAuthRoutes(app);

  // ---- Secure application routes (require JWT org context) ----
  await app.register(async (secureScope) => {
    const authGuard = createAuthGuard({
      audience: config.authAudience,
      issuer: config.authIssuer,
    });

    // Health check for authenticated org users
    secureScope.get(
      "/api/whoami",
      { preHandler: authGuard },
      async (request, reply) => {
        const user = (request as any).user ?? null;
        reply.send({ user });
      },
    );

    // Core org-scoped routes
    await registerBasRoutes(secureScope, authGuard);
    await registerTaxRoutes(secureScope, authGuard);
    await registerForecastRoutes(secureScope);
    await registerOnboardingRoutes(secureScope);
    await registerDemoRoutes(secureScope);
    await registerRiskRoutes(secureScope);
    await registerComplianceProxyRoutes(secureScope, authGuard);
    await registerBankRoutes(secureScope, authGuard);

    // BAS settlement routes (stubbed for now)
    secureScope.register(registerBasSettlementRoutes, { prefix: "/api" });

    // Export and CSV ingest routes
    secureScope.register(exportRoutes, {
      prefix: "/api/export",
    });

    secureScope.register(csvIngestRoutes, { prefix: "/api" });
  });

  // ---- Regulator scope ----
  await app.register(async (regulatorScope) => {
    // JWT-based auth for regulators, using dedicated audience/issuer
    const regulatorJwtGuard = createAuthGuard({
      audience: REGULATOR_AUDIENCE,
      issuer: REGULATOR_ISSUER,
    });

    // Ensure regulator JWT and API key are present for all /regulator routes
    regulatorScope.addHook("onRequest", regulatorJwtGuard);
    regulatorScope.addHook("onRequest", regulatorAuthGuard);
    regulatorScope.addHook("onRequest", ensureRegulatorSessionActive);

    await regulatorScope.register(registerRegulatorRoutes, {
      prefix: "/regulator",
    });

    // Regulator compliance summary endpoint (uses its own file)
    await regulatorScope.register(
      async (inner) => {
        const { registerRegulatorComplianceSummaryRoute } = await import(
          "./routes/regulator-compliance-summary.js"
        );
        registerRegulatorComplianceSummaryRoute(inner);
      },
      { prefix: "/regulator" },
    );
  });

  // --- 404 handler ---
  app.setNotFoundHandler((request, reply) => {
    const error = notFound("Route not found", {
      method: request.method,
      url: request.url,
    });
    reply.code(error.statusCode).send({ error });
  });

  // --- Error handler ---
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn({ err: error }, "AppError");
      reply.code(error.statusCode).send({ error });
      return;
    }

    if ((error as any)?.validation) {
      const vErr = validationError("Request validation failed", {
        details: (error as any).validation,
      });
      reply.code(vErr.statusCode).send({ error: vErr });
      return;
    }

    if ((error as any)?.code === "FST_CORS_FORBIDDEN_ORIGIN") {
      const cErr = badRequest("CORS origin not allowed");
      reply.code(cErr.statusCode).send({ error: cErr });
      return;
    }

    const wrapped = internalError("Internal server error", {
      cause: error,
    });
    request.log.error({ err: error }, "Unhandled error");
    reply.code(wrapped.statusCode).send({ error: httpError(wrapped) });
  });
};
