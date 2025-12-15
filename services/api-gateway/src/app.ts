import Fastify, { type FastifyInstance } from "fastify";
import { prisma } from "./db.js";
import { adminServiceModePlugin } from "./routes/admin-service-mode.js";
import registerRiskSummaryRoutes from "./routes/risk-summary.js";
import { regulatorComplianceSummaryPlugin } from "./routes/regulator-compliance-summary.js";
import { regulatorComplianceEvidencePackPlugin } from "./routes/regulator-compliance-evidence-pack.js";
import adminUsersPlugin from "./routes/admin-users.js";
import { prototypeAdminGuard } from "./guards/prototype-admin.js";

type Environment = "development" | "test" | "production";

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

  const app = Fastify({ logger });

  app.decorate("config", config);

  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async () => ({ ok: true }));

  // DB wiring: src/db exports prisma
  app.decorate("db", prisma);

  // Internal admin endpoint (token-guarded inside plugin)
  app.register(adminServiceModePlugin, { prefix: "/admin" });

  // Prototype-only scope (admin only)
  app.register(async (protoScope) => {
    protoScope.addHook("preHandler", prototypeAdminGuard());

    // Monitoring / risk prototype route
    registerRiskSummaryRoutes(protoScope);

    // Regulator compliance summary (mounted under /regulator/*)
    protoScope.register(regulatorComplianceSummaryPlugin, { prefix: "/regulator" });

    // Evidence pack export (prototype reporting / audit support)
    protoScope.register(regulatorComplianceEvidencePackPlugin, { prefix: "/regulator" });

    // Admin-only prototype route group under /admin/*
    // (safe, deterministic placeholder store for now)
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

    // Optional routes (do not crash if missing)
    const exportMod: any = await tryImport("./routes/export");
    if (exportMod && typeof exportMod.exportPlugin === "function") {
      secureScope.register(exportMod.exportPlugin, { prefix: "/api" });
    }

    const csvMod: any = await tryImport("./routes/csv-ingest");
    if (csvMod && typeof csvMod.csvIngestPlugin === "function") {
      secureScope.register(csvMod.csvIngestPlugin, { prefix: "/api" });
    }
  });

  return app;
}

// Back-compat exports used by server/index/tests
export const createApp = buildFastifyApp;
export const buildServer = buildFastifyApp;
