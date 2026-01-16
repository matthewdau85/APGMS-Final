// services/api-gateway/src/app.ts
import fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

import { prisma } from "./db.js";
import { createInMemoryDb } from "./db/in-memory-db.js";

import { createAuthGuard } from "./auth.js";
import { createServices } from "./services/index.js";
import { createMetrics } from "./observability/metrics.js";

import regulatorComplianceSummaryRoute from "./routes/regulator-compliance-summary.js";
import regulatorComplianceEvidencePackPlugin from "./routes/regulator-compliance-evidence-pack.js";
import { basSettlementRoutes } from "./routes/bas-settlement.js";
import { registerBankLinesRoutes } from "./routes/bank-lines.js";
import { registerRiskSummaryRoute } from "./routes/risk-summary.js";
import {
  isPrototypePath,
  isPrototypeAdminOnlyPath,
} from "./prototype/prototype-paths.js";
import { helmetConfigFor } from "./security-headers.js";

export interface BuildAppOpts {
  auth?: {
    audience: string;
    issuer: string;
  };
  inMemoryDb?: boolean;
  logger?: boolean;
  configOverrides?: {
    environment?: string;
    inMemoryDb?: boolean;
  };
}

export function buildFastifyApp(opts: BuildAppOpts = {}) {
  const app = fastify({ logger: Boolean(opts.logger ?? false) });

  const envName = String(
    opts.configOverrides?.environment ?? process.env.NODE_ENV ?? "development"
  ).toLowerCase();
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (envName === "production" && allowedOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS must be set in production");
  }

  // Production: strict CORS allowlist (tests expect allowed.example to pass)
  app.addHook("onRequest", async (req, reply) => {
    if (envName !== "production") return;

    const origin = String((req.headers as any)?.origin ?? "");
    if (!origin) return;

    const allow = new Set<string>(allowedOrigins);

    if (!allow.has(origin)) {
      reply.code(403).send({ error: "cors_origin_forbidden" });
      return;
    }

    // Ensure the expected header is present even if fastify-cors is configured broadly
    reply.header("access-control-allow-origin", origin);
    reply.header("vary", "Origin");
  });

  app.register(cors, { origin: true });
  app.register(helmet, helmetConfigFor({ cors: { allowedOrigins } }));

  // DB
  const useInMemoryDb = Boolean(
    opts.configOverrides?.inMemoryDb ?? opts.inMemoryDb
  );
  const dbClient = useInMemoryDb ? createInMemoryDb() : prisma;
  (app as any).decorate("db", dbClient);

  // Metrics + Services
  (app as any).decorate("metrics", createMetrics());
  (app as any).decorate(
    "services",
    createServices({ db: dbClient, metrics: (app as any).metrics })
  );

  // Auth guard
  const guard = createAuthGuard(opts.auth);
  (app as any).decorate("authGuard", guard);

  // Health endpoints
  app.get("/health/live", async () => ({ ok: true }));

  app.get("/health/ready", async (_req, reply) => {
    const db = (app as any).db;
    const ready = await checkDbReady(db);
    if (!ready) {
      return reply.code(503).send({ ok: false, checks: { db: false } });
    }
    return reply.send({ ok: true, checks: { db: true } });
  });

  // Back-compat
  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async (_req, reply) => {
    // --- DEV readiness override ---
    if (process.env.DEV_READY_ALWAYS === "1") {
      return reply.code(200).send({
        ok: true,
        mode: "dev",
        skipped: ["db","redis","nats"]
      });
    }
    // --- end override ---
    const db = (app as any).db;
    const ready = await checkDbReady(db);
    if (!ready) {
      return reply.code(503).send({ ok: false, checks: { db: false } });
    }
    return reply.send({ ok: true, checks: { db: true } });
  });

  // Routes
  app.register(regulatorComplianceSummaryRoute);
  app.register(regulatorComplianceEvidencePackPlugin, { prefix: "/regulator" });
  registerRiskSummaryRoute(app);
  registerBankLinesRoutes(app);
  app.register(async (instance) => {
    await basSettlementRoutes(instance, { requireAuth: true });
  }, { prefix: "/api" });

  // APGMS_TEST_BEHAVIOR_HOOKS

  // Determine environment (tests pass configOverrides.environment)
  const env = String(
    opts.configOverrides?.environment ?? process.env.NODE_ENV ?? "development"
  ).toLowerCase();

  // Production: hard-disable prototype/demo endpoints at the edge (404)
  app.addHook("onRequest", async (req, reply) => {
    if (env !== "production") return;

    const url = req.url || "";
    if (isPrototypePath(url)) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
  });

  // Non-production: only SOME prototype endpoints are admin-only (e.g. /monitor/*)
  app.addHook("onRequest", async (req, reply) => {
    if (env === "production") return;

    const url = req.url || "";
    if (!isPrototypeAdminOnlyPath(url)) return;

    const enablePrototype =
      String(process.env.ENABLE_PROTOTYPE ?? "").toLowerCase() === "true";
    if (!enablePrototype) {
      reply.code(404).send({ error: "not_found" });
      return;
    }

    const guard = (app as any).authGuard as
      | ((request: any, response: any) => Promise<void>)
      | undefined;
    if (guard) {
      await guard(req as any, reply as any);
      if (reply.sent) return;
    }

    const userRole = String((req as any).user?.role ?? "");
    const isAdmin = userRole === "admin";

    if (!isAdmin) {
      reply.code(403).send({ error: "admin_only_prototype" });
      return;
    }
  });

  // Metrics route (tests expect /metrics 200 + text/plain)
  app.get("/metrics", async (_req, reply) => {
    const metrics: any = (app as any).metrics;
    const body =
      metrics && typeof metrics.metrics === "function"
        ? await metrics.metrics()
        : "";
    reply.header("content-type", "text/plain; version=0.0.4; charset=utf-8");
    return reply.send(body);
  });

  return app;
}

async function checkDbReady(db: any): Promise<boolean> {
  if (!db) return true;
  const raw =
    db.$executeRawUnsafe ??
    db.$queryRawUnsafe ??
    db.$executeRaw ??
    db.$queryRaw;
  if (typeof raw !== "function") {
    return true;
  }
  try {
    await raw.call(db, "SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Back-compat for older tests: buildApp == buildFastifyApp
 */
export const buildApp = buildFastifyApp;
