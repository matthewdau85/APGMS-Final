// services/api-gateway/src/server.ts
import rateLimit from "@fastify/rate-limit";

import { buildFastifyApp } from "./app.js";
import authRoutes from "./routes/auth.js";
import prototypeRoutes from "./routes/prototype.js";
import { registerAuth } from "./plugins/auth.js";

export function buildServer() {
  const app = buildFastifyApp({ logger: true });

  app.register(rateLimit, {
    max: Number(process.env.API_RATE_LIMIT_MAX ?? 120),
    timeWindow: process.env.API_RATE_LIMIT_WINDOW ?? "1 minute",
  });

  registerAuth(app);
  app.register(authRoutes);

  // Prototype surface is mounted under /prototype
  app.register(prototypeRoutes, { prefix: "/prototype" });

  return app;
}
