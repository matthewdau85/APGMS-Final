// services/api-gateway/src/app.ts
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

import regulatorComplianceSummaryRoute from "./routes/regulator-compliance-summary.js";
import regulatorComplianceEvidencePackPlugin from "./routes/regulator-compliance-evidence-pack.js";
import { basSettlementRoutes } from "./routes/bas-settlement.js";
import { registerBankLinesRoutes } from "./routes/bank-lines.js";
import { registerRiskSummaryRoute } from "./routes/risk-summary.js";

import {
  isPrototypePath,
  isPrototypeAdminOnlyPath,
} from "./prototype/prototype-paths.js";

import { helmetConfigFor } from "./lib/helmet-config.js";

type BuildAppOpts = {
  logger?: boolean;
  configOverrides?: {
    environment?: string;
  };
};

export function buildFastifyApp(opts: BuildAppOpts = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? true });

  const envName = String(
    opts.configOverrides?.environment ?? process.env.NODE_ENV ?? "development"
  ).toLowerCase();

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.register(cors, { origin: true });
  app.register(helmet, helmetConfigFor({ cors: { allowedOrigins } }));

  // /ready (dev override)
  app.get("/ready", async (_req, reply) => {
    const alwaysReady = String(process.env.DEV_READY_ALWAYS ?? "").toLowerCase() === "1"
      || String(process.env.DEV_READY_ALWAYS ?? "").toLowerCase() === "true";

    if (alwaysReady) {
      return reply.code(200).send({
        ok: true,
        mode: "dev",
        skipped: ["db", "redis", "nats"],
      });
    }

    // If you later re-enable real checks, do it here.
    return reply.code(200).send({ ok: true });
  });

  // /health
  app.get("/health", async () => ({ ok: true }));

  // Business routes
  app.register(regulatorComplianceSummaryRoute);
  app.register(regulatorComplianceEvidencePackPlugin, { prefix: "/regulator" });
  registerRiskSummaryRoute(app);
  registerBankLinesRoutes(app);

  app.register(
    async (instance) => {
      await basSettlementRoutes(instance, { requireAuth: true });
    },
    { prefix: "/api" }
  );

  // In production: hard-disable prototype/demo surfaces even if registered
  app.addHook("onRequest", async (req, reply) => {
    if (envName !== "production") return;
    const url = req.url || "";
    if (isPrototypePath(url)) {
      reply.code(404).send({ error: "not_found" });
    }
  });

  // Non-prod: optionally add extra admin-only prototype surfaces (not used yet)
  app.addHook("onRequest", async (req, reply) => {
    if (envName === "production") return;
    const url = req.url || "";
    if (!isPrototypeAdminOnlyPath(url)) return;
    // If you add monitor endpoints later, enforce admin auth here.
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

// Back-compat alias if other code expects it
export const buildApp = buildFastifyApp;
