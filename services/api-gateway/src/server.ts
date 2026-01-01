import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

import regulatorComplianceSummaryDemo from "./routes/regulator-compliance-summary.demo.js";
import { registerRiskSummaryRoute } from "./routes/risk-summary.js";

export function buildServer() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  /**
   * =========================================================
   * CORS — EXPLICIT + WEBAPP SAFE
   * =========================================================
   */
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.register(cors, {
    origin: (origin, cb) => {
      // server-to-server / curl (no Origin header)
      if (!origin) return cb(null, true);

      if (allowedOrigins.length === 0) {
        // If you forget to set CORS_ALLOWED_ORIGINS, default to permissive in dev.
        // Tighten this for prod.
        return cb(null, true);
      }

      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked origin: ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Request-Id",
      "X-Regulator-Code",
      "X-Org-Id",
      "x-org-id",
    ],
    exposedHeaders: ["X-Request-Id"],
  });

  /**
   * =========================================================
   * RATE LIMITING
   * =========================================================
   */
  app.register(rateLimit, {
    max: Number(process.env.API_RATE_LIMIT_MAX ?? 120),
    timeWindow: process.env.API_RATE_LIMIT_WINDOW ?? "1 minute",
  });

  /**
   * =========================================================
   * HEALTH / READINESS
   * =========================================================
   * Define these HERE (and nowhere else) to avoid duplicated routes.
   */
  app.get("/health/live", async () => ({ ok: true }));
  app.get("/health/ready", async () => ({ ok: true }));

  /**
   * =========================================================
   * ROUTES
   * =========================================================
   */
  registerRiskSummaryRoute(app);

  // Demo endpoints:
  // - /compliance/summary
  // - /regulator/compliance/summary
  app.register(regulatorComplianceSummaryDemo);
  app.register(regulatorComplianceSummaryDemo, { prefix: "/regulator" });

  return app;
}
