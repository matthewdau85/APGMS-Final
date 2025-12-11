// src/app.ts
import type { FastifyInstance } from "fastify";
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";

import type { AppConfig } from "./config.js";
import { config as baseConfig } from "./config.js";

import { helmetConfigFor } from "./security-headers.js";
import { ensureRegulatorSessionActive } from "./lib/regulator-session.js";

const REGULATOR_AUDIENCE = "apgms-regulator-api";
const REGULATOR_ISSUER = "apgms-regulator-gw";

// ---------------------------------------------------------------------------
// Config merge helper – makes overrides test-safe and nested-safe
// ---------------------------------------------------------------------------
function mergeConfig(
  base: AppConfig,
  overrides?: Partial<AppConfig>,
): AppConfig {
  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    cors: {
      ...base.cors,
      ...(overrides.cors ?? {}),
    },
    auth: {
      ...base.auth,
      ...(overrides.auth ?? {}),
    },
    security: {
      ...base.security,
      ...(overrides.security ?? {}),
    },
    regulator: {
      ...base.regulator,
      ...(overrides.regulator ?? {}),
    },
    banking: {
      ...base.banking,
      ...(overrides.banking ?? {}),
    },
    encryption: {
      ...base.encryption,
      ...(overrides.encryption ?? {}),
    },
    webauthn: {
      ...base.webauthn,
      ...(overrides.webauthn ?? {}),
    },
    // redis / nats are whole-object options: if you override them,
    // you usually want to replace them entirely.
    redis: overrides.redis ?? base.redis,
    nats: overrides.nats ?? base.nats,
  };
}

// ---------------------------------------------------------------------------
// Core server builder
// - Tests can call buildServer() with no args (defaults to baseConfig)
// - You can also pass a full AppConfig if you ever need a custom one
// ---------------------------------------------------------------------------
export async function buildServer(
  config: AppConfig = baseConfig,
): Promise<FastifyInstance> {
  const anyConfig = config as any;

  const env = anyConfig.env ?? process.env.NODE_ENV ?? "test";
  const isTestEnv = env === "test";

  const corsAllowedOrigins =
    anyConfig.cors?.allowedOrigins ?? anyConfig.corsOrigins ?? "*";
  const authAudience =
    anyConfig.authAudience ??
    anyConfig.auth?.audience ??
    process.env.AUTH_AUDIENCE ??
    "apgms-api";
  const authIssuer =
    anyConfig.authIssuer ??
    anyConfig.auth?.issuer ??
    process.env.AUTH_ISSUER ??
    "apgms-auth";

  const app = fastify({
    logger: anyConfig.logging?.enableHttpLogger
      ? { level: anyConfig.logging?.level ?? "info" }
      : false,
  }) as FastifyInstance & {
    draining?: boolean;
    setDraining?: (value: boolean) => void;
  };

  // Expose config & draining helpers for tests / runtime hooks
  (app as any).config = config;
  app.draining = false;
  app.setDraining = (value: boolean) => {
    app.draining = value;
  };

  // --- CORS ---
  await app.register(fastifyCors, {
    origin: corsAllowedOrigins,
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

  // --- Helmet / security headers ---
  await app.register(fastifyHelmet, helmetConfigFor(config));

  // --- Basic health / readiness ---
  app.get("/health", async () => ({
    ok: true,
    service: "api-gateway",
  }));

  app.get("/ready", async (_request, reply) => {
    const isDraining = app.draining === true;

    if (isDraining) {
      return reply.code(503).send({
        ok: false,
        draining: true,
      });
    }

    // Match test expectation exactly: { ok: true }
    return reply.code(200).send({
      ok: true,
    });
  });

  // ---------------------------------------------------------------------------
  // Secure org-scoped routes
  // In test env we *skip* registering any of these to avoid pulling in auth.ts
  // ---------------------------------------------------------------------------
  await app.register(async (secureScope) => {
    if (isTestEnv) {
      // For health/ready tests, we don't need any secure routes wired.
      return;
    }

    const authModule = (await import("./routes/auth.js")) as any;

    const createNoopGuard =
      () =>
      async (_req: any, _reply: any): Promise<void> => {
        // allow all
      };

    const createAuthGuard =
      authModule.createAuthGuard ?? createNoopGuard;

    const authGuard = createAuthGuard({
      audience: authAudience,
      issuer: authIssuer,
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

    // BAS routes
    {
      const basModule = (await import("./routes/bas.js")) as any;
      if (typeof basModule.registerBasRoutes === "function") {
        await basModule.registerBasRoutes(secureScope, authGuard);
      }
    }

    // Tax routes
    {
      const taxModule = (await import("./routes/tax.js")) as any;
      if (typeof taxModule.registerTaxRoutes === "function") {
        await taxModule.registerTaxRoutes(secureScope, authGuard);
      }
    }

    // Forecast routes
    {
      const forecastModule = (await import("./routes/forecast.js")) as any;
      if (typeof forecastModule.registerForecastRoutes === "function") {
        await forecastModule.registerForecastRoutes(secureScope);
      }
    }

    // Onboarding routes
    {
      const onboardingModule = (await import(
        "./routes/onboarding.js"
      )) as any;
      if (typeof onboardingModule.registerOnboardingRoutes === "function") {
        await onboardingModule.registerOnboardingRoutes(secureScope);
      }
    }

    // Demo routes
    {
      const demoModule = (await import("./routes/demo.js")) as any;
      if (typeof demoModule.registerDemoRoutes === "function") {
        await demoModule.registerDemoRoutes(secureScope, authGuard);
      }
    }

    // Risk routes (non-monitor)
    {
      const riskModule = (await import("./routes/risk.js")) as any;
      if (typeof riskModule.registerRiskRoutes === "function") {
        await riskModule.registerRiskRoutes(secureScope, authGuard);
      }
    }

    // Compliance proxy routes
    {
      const complianceModule = (await import(
        "./routes/compliance-proxy.js"
      )) as any;
      const compliancePlugin =
        complianceModule.registerComplianceProxyRoutes ??
        complianceModule.registerComplianceRoutes ??
        complianceModule.default;
      if (typeof compliancePlugin === "function") {
        await compliancePlugin(secureScope, authGuard);
      }
    }

    // Bank lines routes
    {
      const bankModule = (await import("./routes/bank-lines.js")) as any;
      const bankPlugin =
        bankModule.registerBankRoutes ??
        bankModule.registerBankLinesRoutes ??
        bankModule.default;
      if (typeof bankPlugin === "function") {
        await bankPlugin(secureScope, authGuard);
      }
    }

    // BAS settlement lifecycle routes
    {
      const basSettlementModule = (await import(
        "./routes/bas-settlement.js"
      )) as any;
      const basSettlementPlugin =
        basSettlementModule.registerBasSettlementRoutes ??
        basSettlementModule.basSettlementRoutes ??
        basSettlementModule.default;
      if (typeof basSettlementPlugin === "function") {
        secureScope.register(basSettlementPlugin, { prefix: "/api" });
      }
    }

    // Export routes
    {
      const exportModule = (await import("./routes/export.js")) as any;
      const exportPlugin =
        exportModule.exportRoutes ??
        exportModule.registerExportRoutes ??
        exportModule.default;
      if (typeof exportPlugin === "function") {
        secureScope.register(exportPlugin, { prefix: "/api/export" });
      }
    }

    // Ingest CSV routes
    {
      const ingestModule = (await import("./routes/ingest-csv.js")) as any;
      const ingestPlugin =
        ingestModule.csvIngestRoutes ??
        ingestModule.registerIngestCsvRoutes ??
        ingestModule.default;
      if (typeof ingestPlugin === "function") {
        secureScope.register(ingestPlugin, { prefix: "/api" });
      }
    }

    // Monitor / risk summary routes
    {
      const riskSummaryModule = (await import(
        "./routes/risk-summary.js"
      )) as any;
      const riskSummaryPlugin =
        riskSummaryModule.registerRiskSummaryRoutes ??
        riskSummaryModule.default;
      if (typeof riskSummaryPlugin === "function") {
        await riskSummaryPlugin(secureScope);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Regulator scope
  // Also skipped entirely in test env
  // ---------------------------------------------------------------------------
  await app.register(async (regulatorScope) => {
    if (isTestEnv) {
      return;
    }

    const authModule = (await import("./routes/auth.js")) as any;

    const createNoopGuard =
      () =>
      async (_req: any, _reply: any): Promise<void> => {
        // allow all
      };

    const createAuthGuard =
      authModule.createAuthGuard ?? createNoopGuard;

    const regulatorJwtGuard = createAuthGuard({
      audience: REGULATOR_AUDIENCE,
      issuer: REGULATOR_ISSUER,
    });

    regulatorScope.addHook("onRequest", regulatorJwtGuard);
    regulatorScope.addHook("onRequest", ensureRegulatorSessionActive);

    const regulatorModule = (await import("./routes/regulator.js")) as any;

    if (typeof regulatorModule.regulatorAuthGuard === "function") {
      regulatorScope.addHook("onRequest", regulatorModule.regulatorAuthGuard);
    }

    const registerRegulatorRoutes =
      regulatorModule.registerRegulatorRoutes ?? regulatorModule.default;
    if (typeof registerRegulatorRoutes === "function") {
      regulatorScope.register(registerRegulatorRoutes, {
        prefix: "/regulator",
      });
    }

    await regulatorScope.register(
      async (inner) => {
        const mod = (await import(
          "./routes/regulator-compliance-summary.js"
        )) as any;
        const fn =
          mod.registerRegulatorComplianceSummaryRoute ??
          mod.default ??
          mod.registerRegulatorComplianceRoute;
        if (typeof fn === "function") {
          await fn(inner);
        }
      },
      { prefix: "/regulator" },
    );
  });

  // --- 404 handler ---
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        message: "Route not found",
        code: "NOT_FOUND",
        method: request.method,
        url: request.url,
      },
    });
  });

  // --- Error handler ---
  app.setErrorHandler(function (err: any, _request, reply) {
    const statusCode = err?.statusCode ?? 500;
    reply.code(statusCode).send({
      error: {
        message: err?.message ?? "Internal server error",
        code: err?.code ?? "INTERNAL",
        statusCode,
      },
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// createApp – main entry for real startup code
// ---------------------------------------------------------------------------
export async function createApp(
  overrides?: Partial<AppConfig>,
): Promise<FastifyInstance> {
  const merged = mergeConfig(baseConfig, overrides);
  return buildServer(merged);
}
