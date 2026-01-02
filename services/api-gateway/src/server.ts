import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

import regulatorComplianceSummaryDemo from "./routes/regulator-compliance-summary.demo.js";
import authRoutes from "./routes/auth.js";
import prototypeRoutes from "./routes/prototype.js";
import { registerAuth } from "./plugins/auth.js";

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
      // Allow non-browser callers (curl, server-to-server)
      if (!origin) return cb(null, true);

      // If list is empty, allow (dev-friendly)
      if (allowedOrigins.length === 0) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);

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
  app.get("/health/ready", async () => ({ ok: true }));
  app.get("/health/live", async () => ({ ok: true }));

  /**
   * =========================================================
   * AUTH
   * =========================================================
   */
  registerAuth(app);
  app.register(authRoutes);

  /**
   * =========================================================
   * ROUTES (production + prototype)
   * =========================================================
   */
  registerRiskSummaryRoute(app);

  // Demo regulator summary (mount under /regulator)
  app.register(regulatorComplianceSummaryDemo, { prefix: "/regulator" });

  // Prototype surface (mount under /prototype)
  app.register(prototypeRoutes, { prefix: "/prototype" });

  return app;
}
