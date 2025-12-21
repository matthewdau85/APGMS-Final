import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

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
    .map(o => o.trim())
    .filter(Boolean);

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }

      cb(new Error(`CORS blocked origin: ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Request-Id",
      "X-Regulator-Code",
      "X-Org-Id",
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
   */
  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async () => ({ ok: true }));

  /**
   * =========================================================
   * ROUTES
   * =========================================================
   */
  registerRiskSummaryRoute(app);

  return app;
}
