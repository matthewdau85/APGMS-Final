// services/api-gateway/src/app.ts

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { prisma, setPrismaClientForTests } from "./db.js";

import regulatorComplianceSummaryRoute from "./routes/regulator-compliance-summary.js";
import basSettlementRoutes from "./routes/bas-settlement.js";

import * as promClient from "prom-client";

import { adminServiceModePlugin } from "./routes/admin-service-mode.js";
import { registerRiskSummaryRoute } from "./routes/risk-summary.js";
import { regulatorComplianceEvidencePackPlugin } from "./routes/regulator-compliance-evidence-pack.js";
import adminUsersPlugin from "./routes/admin-users.js";
import { prototypeAdminGuard } from "./guards/prototype-admin.js";

import registerMetricsRoutes from "./routes/metrics.js";
import { metrics } from "./observability/metrics.js";

import adminDataRoutes from "./routes/admin.data.js";

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

/* ---------------- Metrics ---------------- */

function ensureDbQueryDurationMetric() {
  const existing = promClient.register.getSingleMetric("apgms_db_query_duration_seconds");
  if (existing) return;

  new promClient.Histogram({
    name: "apgms_db_query_duration_seconds",
    help: "DB query duration in seconds",
    labelNames: ["model", "op"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });
}

/* ---------------- In-memory helpers ---------------- */

function createInMemoryAdminUsersRiskStore(): any {
  const map = new Map<string, any>();
  const keyOf = (x: any) => {
    try {
      return typeof x === "string" ? x : JSON.stringify(x);
    } catch {
      return String(x);
    }
  };

  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (["get", "read", "find", "getRisk", "getRiskBand"].includes(String(prop))) {
          return async (...args: any[]) => map.get(keyOf(args[0] ?? args)) ?? null;
        }
        if (["set", "write", "put", "setRisk", "setRiskBand", "upsert"].includes(String(prop))) {
          return async (...args: any[]) => {
            const k = keyOf(args[0] ?? args);
            const v = args.length >= 2 ? args[1] : args[0];
            map.set(k, v);
          };
        }
        if (["list", "all"].includes(String(prop))) {
          return async () => Array.from(map.values());
        }
        if (["clear", "reset"].includes(String(prop))) {
          return async () => map.clear();
        }
        return async () => null;
      },
    },
  );
}

/* ---------------- Minimal Prisma-like DB ---------------- */

function createInMemoryDb(): any {
  const store = new Map<string, any[]>();
  const counters = new Map<string, number>();

  const nextId = (model: string) => {
    const n = (counters.get(model) ?? 0) + 1;
    counters.set(model, n);
    return `${model}_${n}`;
  };

  const getRows = (model: string) => {
    if (!store.has(model)) store.set(model, []);
    return store.get(model)!;
  };

  const matchWhere = (row: any, where: any): boolean => {
    if (!where) return true;
    if (Array.isArray(where.AND)) return where.AND.every((w: any) => matchWhere(row, w));
    if (Array.isArray(where.OR)) return where.OR.some((w: any) => matchWhere(row, w));
    return Object.entries(where).every(([k, v]) => row[k] === v);
  };

  const modelApi = (model: string) => ({
    create: async ({ data }: any) => {
      const row = { id: data.id ?? nextId(model), ...data };
      getRows(model).push(row);
      return row;
    },
    createMany: async ({ data }: any) => {
      for (const d of data ?? []) {
        getRows(model).push({ id: d.id ?? nextId(model), ...d });
      }
      return { count: (data ?? []).length };
    },
    findMany: async ({ where }: any = {}) =>
      getRows(model).filter((r) => matchWhere(r, where)),
    findFirst: async ({ where }: any = {}) =>
      getRows(model).find((r) => matchWhere(r, where)) ?? null,
    upsert: async ({ where, create, update }: any) => {
      const rows = getRows(model);
      const idx = rows.findIndex((r) => matchWhere(r, where));
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...update };
        return rows[idx];
      }
      const row = { id: create.id ?? nextId(model), ...create };
      rows.push(row);
      return row;
    },
    deleteMany: async ({ where }: any = {}) => {
      const rows = getRows(model);
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matchWhere(rows[i], where)) {
          rows.splice(i, 1);
          count++;
        }
      }
      return { count };
    },
  });

  // 🔑 define client FIRST so the proxy can reference it
  const client: any = {};

  return new Proxy(client, {
    get(_t, prop: string | symbol) {
      if (prop === "$transaction") {
        return async (fn: any) =>
          typeof fn === "function" ? fn(client) : fn;
      }
      if (typeof prop === "string") {
        return modelApi(prop);
      }
      return undefined;
    },
  });
}

/* ---------------- App Builder ---------------- */

export function buildFastifyApp(options: BuildFastifyAppOptions = {}): FastifyInstance {
  const logger = options.logger ?? false;

  const baseConfig: AppConfig = {
    environment: (process.env.NODE_ENV as Environment) ?? "development",
    auth: {
      audience: process.env.AUTH_AUDIENCE ?? "apgms-api",
      issuer: process.env.AUTH_ISSUER ?? "https://issuer.example",
    },
    inMemoryDb: options.inMemoryDb ?? false,
  };

  const config = { ...baseConfig, ...options.configOverrides };
  const app = Fastify({ pluginTimeout: 60000, logger });

  ensureDbQueryDurationMetric();

  const useInMemoryDb = config.environment === "test" || config.inMemoryDb;
  const dbClient = useInMemoryDb ? createInMemoryDb() : prisma;
  app.decorate("db", dbClient);
  if (useInMemoryDb) setPrismaClientForTests(dbClient);

  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async () => ({ ok: true }));

  app.register(cors, { origin: true, credentials: true });

  app.register(registerMetricsRoutes);
  metrics.installHttpMetrics(app);

  /* -------- Prototype (non-prod) -------- */

  if (config.environment !== "production") {
    const adminGuard = prototypeAdminGuard({ config });

    app.addHook("onRequest", async (req, reply) => {
      const url = String(req.raw.url ?? "");
      if (url.startsWith("/admin") || url.startsWith("/api/admin")) {
        await adminGuard(req, reply);
      }
    });

    app.register(
      async (adminScope) => {
        adminScope.register(adminDataRoutes);
        adminScope.register(adminServiceModePlugin);
        adminScope.register(adminUsersPlugin, { riskStore: createInMemoryAdminUsersRiskStore() });
      },
      { prefix: "/admin" },
    );

    app.register(regulatorComplianceSummaryRoute);
    app.register(regulatorComplianceEvidencePackPlugin, { prefix: "/regulator" });
    registerRiskSummaryRoute(app);
  }

  /* -------- Secure /api -------- */

  app.register(async (secureScope) => {
    const { authGuard } = await import("./auth.js");
    if (typeof authGuard !== "function") throw new Error("authGuard missing");

    secureScope.addHook("preHandler", authGuard);

    secureScope.register(regulatorComplianceSummaryRoute, { prefix: "/api" });
    secureScope.register(basSettlementRoutes);

    secureScope.register(adminDataRoutes, { prefix: "/api/admin" });
    secureScope.register(regulatorComplianceEvidencePackPlugin, { prefix: "/api/regulator" });
  });

  return app;
}

export const createApp = buildFastifyApp;
export const buildServer = buildFastifyApp;
export const buildApp = buildFastifyApp;
