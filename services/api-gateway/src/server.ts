// services/api-gateway/src/server.ts
import rateLimit from "@fastify/rate-limit";

import { buildFastifyApp } from "./app.js";
import authRoutes from "./routes/auth.js";
import prototypeRoutes from "./routes/prototype.js";
import { registerAuth } from "./plugins/auth.js";
import { registerDemoRoutes } from "./routes/demo.js";

import readyRoutes from "./routes/ready.js";
import orgSetupRoutes from "./routes/org-setup.js";

export function buildServer() {
  const app = buildFastifyApp({ logger: true });

  app.register(rateLimit, {
    max: Number(process.env.API_RATE_LIMIT_MAX ?? 120),
    timeWindow: process.env.API_RATE_LIMIT_WINDOW ?? "1 minute",
  });

  // Public utility endpoints (no auth)
  app.register(readyRoutes);

  // Org setup surface (bootstrap flow used by scripts/verify-setup.sh)
  app.register(orgSetupRoutes);

  // Auth surface
  registerAuth(app);
  app.register(authRoutes);

  // Prototype surface (mounted under /prototype)
  app.register(prototypeRoutes, { prefix: "/prototype" });

  // Demo surface (mounted at /demo/*)
  // Internally guarded by prototypeAdminGuard which enforces ENABLE_PROTOTYPE + header.
  registerDemoRoutes(app);

  return app;
}
