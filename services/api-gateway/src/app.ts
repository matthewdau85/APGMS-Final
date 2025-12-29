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
import { registerRiskSummaryRoute } from "./routes/risk-summary.js";

export interface BuildAppOpts {
  auth?: {
    audience: string;
    issuer: string;
  };
  inMemoryDb?: boolean;
}

export async function buildFastifyApp(opts: BuildAppOpts = {}) {
  const app = fastify({ logger: false });

  await app.register(cors, { origin: true });
  await app.register(helmet);

  // DB
  const useInMemoryDb = Boolean(opts.inMemoryDb);
  const dbClient = useInMemoryDb ? createInMemoryDb() : prisma;
  (app as any).decorate("db", dbClient);

  // Metrics + Services
  (app as any).decorate("metrics", createMetrics());
  (app as any).decorate("services", createServices({ db: dbClient, metrics: (app as any).metrics }));

  // Auth guard
  const guard = createAuthGuard(opts.auth);
  (app as any).decorate("authGuard", guard);

  // Health endpoints
  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async () => ({ ok: true }));

  // Routes
  app.register(regulatorComplianceSummaryRoute);
  app.register(regulatorComplianceEvidencePackPlugin, { prefix: "/regulator" });
  registerRiskSummaryRoute(app);

  return app;
}
