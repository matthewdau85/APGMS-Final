// services/api-gateway/src/app.ts
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

import regulatorComplianceSummaryRoute from "./routes/regulator-compliance-summary.js";
import regulatorComplianceEvidencePackPlugin from "./routes/regulator-compliance-evidence-pack.js";
import { basSettlementRoutes } from "./routes/bas-settlement.js";
import { basPreviewRoutes } from "./routes/bas-preview.js";
import { designatedAccountRoutes } from "./routes/designated-accounts.js";
import { alertsRoutes } from "./routes/alerts.js";
import evidenceRoutes from "./routes/evidence.js";

import {
  isPrototypePath,
  isPrototypeAdminOnlyPath,
} from "./prototype/prototype-paths.js";

import { helmetConfigFor } from "./security-headers.js";

export interface BuildAppOpts {
  logger?: boolean;
}

export function buildFastifyApp(opts: BuildAppOpts = {}): FastifyInstance {
  const env = String(process.env.NODE_ENV ?? "development").toLowerCase();
  const app = Fastify({ logger: Boolean(opts.logger) });

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.register(cors, { origin: true });
  app.register(helmet, helmetConfigFor({ cors: { allowedOrigins } }));

  // Production: hard-disable prototype/demo endpoints at the edge (404)
  app.addHook("onRequest", async (req, reply) => {
    if (env !== "production") return;

    const url = req.url || "";
    if (isPrototypePath(url)) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
  });

  // Non-production: enforce admin-only gating on prototype/demo paths (403)
  app.addHook("onRequest", async (req, reply) => {
    if (env === "production") return;

    const url = req.url || "";
    if (!isPrototypeAdminOnlyPath(url)) return;

    const enablePrototype = String(process.env.ENABLE_PROTOTYPE ?? "").toLowerCase() === "true";
    if (!enablePrototype) {
      reply.code(404).send({ error: "not_found" });
      return;
    }

    const raw = String((req.headers as any)["x-prototype-admin"] ?? "").toLowerCase();
    const ok = raw === "1" || raw === "true";
    if (!ok) {
      reply.code(403).send({ ok: false, error: "admin_only_prototype" });
      return;
    }
  });

  // Core routes
  app.register(regulatorComplianceSummaryRoute);
  app.register(regulatorComplianceEvidencePackPlugin, { prefix: "/regulator" });

  app.register(alertsRoutes);
  app.register(designatedAccountRoutes);
  app.register(basPreviewRoutes);
  app.register(mfaRoutes);
  app.register(evidenceRoutes);
  app.register(basSettlementRoutes);

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

/**
 * Back-compat for older tests: buildApp == buildFastifyApp
 */
export const buildApp = buildFastifyApp;
