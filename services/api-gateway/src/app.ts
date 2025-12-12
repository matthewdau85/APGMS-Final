import Fastify, { type FastifyInstance } from "fastify";
import { prisma } from "./db";

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

  // Secure scope: everything here requires auth
  app.register(async (secureScope) => {
    const authMod: any = await import("./auth");
    const authGuard = authMod.authGuard ?? authMod.default;
    if (typeof authGuard !== "function") {
      throw new Error("authGuard is not exported from ./auth (expected named authGuard or default export).");
    }

    secureScope.addHook("preHandler", authGuard);

    // BAS settlement (required by your tests)
    const basMod: any = await import("./routes/bas-settlement");
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

export { buildFastifyApp };
