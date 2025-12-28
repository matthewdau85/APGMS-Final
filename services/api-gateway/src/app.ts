import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./db.js";

import { adminServiceModePlugin } from "./routes/admin-service-mode.js";
import { registerRiskSummaryRoute } from "./routes/risk-summary.js";
import { regulatorComplianceSummaryPlugin } from "./routes/regulator-compliance-summary.js";
import { regulatorComplianceEvidencePackPlugin } from "./routes/regulator-compliance-evidence-pack.js";
import adminUsersPlugin from "./routes/admin-users.js";
import { prototypeAdminGuard } from "./guards/prototype-admin.js";
import registerMetricsRoutes from "./routes/metrics.js"
import { getMetrics } from "../observability/metrics.js";

type Environment = "development" | "test" | "production";

const metrics = getMetrics();

export interface AppConfig {
  environment: Environment;
  auth: {
    audience: string;
    issuer: string;
  };
  inMemoryDb: boolean;
}

export interface BuildFastifyAppOptions {
  logger?: boolean;
  inMemoryDb?: boolean;
  configOverrides?: Partial<AppConfig>;
}

function mergeConfig(base: AppConfig, overrides?: Partial<AppConfig>): AppConfig {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    auth: {
      ...base.auth,
      ...(overrides.auth ?? {}),
    },
  };
}

async function tryImport(path: string): Promise<any | null> {
  try {
    return await import(path);
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (
      err?.code === "MODULE_NOT_FOUND" ||
      msg.includes("Cannot find module") ||
      msg.includes("ERR_MODULE_NOT_FOUND")
    ) {
      return null;
    }
    throw err;
  }
}

// ---- CORS (tight in production) ----
function parseCorsAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildFastifyApp(options: BuildFastifyAppOptions = {}): FastifyInstance {
  const logger = options.logger ?? true;

  const baseConfig: AppConfig = {
    environment: (process.env.NODE_ENV as Environment) ?? "development",
    auth: {
      audience: process.env.AUTH_AUDIENCE ?? "apgms-api",
      issuer: process.env.AUTH_ISSUER ?? "https://issuer.example",
    },
    inMemoryDb: options.inMemoryDb ?? false,
  };

  const config = mergeConfig(baseConfig, options.configOverrides);

  const app = Fastify({ pluginTimeout: 60000, logger });

  // ---- CORS policy ----
  const isProd = config.environment === "production";
  const corsAllowlist = parseCorsAllowlist(process.env.CORS_ALLOWED_ORIGINS);

  // In production we set CORS headers only for allowlisted origins.
  // In non-prod we allow all origins (dev/test convenience).
  app.register(cors, {
    origin: isProd ? corsAllowlist : true,
    credentials: true,
  });

  // Tight enforcement: if Origin is present in production and not allowlisted, reject.
  if (isProd) {
    app.addHook("onRequest", async (req, reply) => {
      const origin = String(req.headers.origin ?? "");
      if (!origin) return; // non-browser / server-to-server calls
      if (!corsAllowlist.includes(origin)) {
        return reply.code(403).send({ error: "cors_origin_forbidden" });
      }
    });
  }

  app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", getMetricsRegistry().contentType);
  res.end(await getMetricsRegistry().metrics());
});

  // Basic health endpoints (tests expect these)
  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async () => ({ ok: true }));

  // DB wiring (existing code expects prisma)
  app.decorate("db", prisma);

  // Admin service-mode (expects /admin prefix)
  app.register(adminServiceModePlugin, { prefix: "/admin" });

// Metrics (Prometheus)
// Keep this OUTSIDE auth scope so ops can scrape it.
// If you want it locked down in prod, set METRICS_BEARER_TOKEN.
registerMetricsRoutes(app, { environment: config.environment });

  // Prototype-only scope (admin only)
  // SECURITY: Never ship prototype routes in production.
  if (config.environment !== "production") {
    app.register(async (protoScope) => {
      // Pass config so the guard doesn't rely on NODE_ENV (Jest forces NODE_ENV="test").
      protoScope.addHook("preHandler", prototypeAdminGuard({ config }));

      // Monitoring route(s)
      registerRiskSummaryRoute(protoScope);

      // IMPORTANT:
      // These route modules already include "/regulator/..." in their route URLs,
      // so DO NOT mount them with prefix "/regulator" (that would become "/regulator/regulator/...").
      protoScope.register(regulatorComplianceSummaryPlugin);
      protoScope.register(regulatorComplianceEvidencePackPlugin);

      // Admin-only prototype route group under /admin/*
      protoScope.register(
        adminUsersPlugin,
        {
          prefix: "/admin",
          riskStore: {
            async recordRiskEvent() {
              // no-op (prototype). Replace with durable store later.
            },
          },
        } as any
      );
    });
  }

  // Secure scope: everything here requires auth
  app.register(async (secureScope) => {
    const authMod: any = await import("./auth.js");
    const authGuard = authMod.authGuard ?? authMod.default;

    if (typeof authGuard !== "function") {
      throw new Error(
        "authGuard is not exported from ./auth (expected named authGuard or default export)."
      );
    }

    secureScope.addHook("preHandler", authGuard);

    // BAS settlement (required)
    const basMod: any = await import("./routes/bas-settlement.js");
    const basSettlementPlugin = basMod.basSettlementPlugin ?? basMod.default;

    if (typeof basSettlementPlugin !== "function") {
      throw new Error("basSettlementPlugin is not exported from ./routes/bas-settlement.");
    }

    // Register under both:
    // - /settlements/bas/* (test env only)
    // - /api/settlements/bas/* (always)
    const isJest = typeof process.env.JEST_WORKER_ID !== "undefined";
    if (config.environment === "test" || isJest) {
      secureScope.register(basSettlementPlugin);
    }
    secureScope.register(basSettlementPlugin, { prefix: "/api" });

    // Optional secured routes:
    // Mount ONLY under /api to avoid any chance of double-registering "/export/bas/v1" etc.
    const exportMod: any = await tryImport("./routes/export.js");
    const registerExportRoutes =
      exportMod?.registerExportRoutes ?? exportMod?.exportRoutes ?? exportMod?.default;
    if (typeof registerExportRoutes === "function") {
      secureScope.register(
        async (apiScope) => {
          await registerExportRoutes(apiScope);
        },
        { prefix: "/api" }
      );
    }

    const ingestMod: any = await tryImport("./routes/ingest-csv.js");
    const registerIngestCsvRoutes = ingestMod?.registerIngestCsvRoutes ?? ingestMod?.default;
    if (typeof registerIngestCsvRoutes === "function") {
      secureScope.register(
        async (apiScope) => {
          await registerIngestCsvRoutes(apiScope);
        },
        { prefix: "/api" }
      );
    }

    const bankLinesMod: any = await tryImport("./routes/bank-lines.js");
    const registerBankLinesRoutes =
      bankLinesMod?.registerBankLinesRoutes ?? bankLinesMod?.default;
    if (typeof registerBankLinesRoutes === "function") {
      secureScope.register(
        async (apiScope) => {
          await registerBankLinesRoutes(apiScope);
        },
        { prefix: "/api" }
      );
    }
  });

  return app;
}

// Back-compat exports used by server/index/tests
export const createApp = buildFastifyApp;
export const buildServer = buildFastifyApp;
