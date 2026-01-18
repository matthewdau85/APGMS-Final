import rateLimit from "@fastify/rate-limit";

import { buildFastifyApp } from "./app.js";
import authRoutes from "./routes/auth.js";
import prototypeRoutes from "./routes/prototype.js";
import { registerAuth } from "./plugins/auth.js";

export function buildServer() {
  const app = buildFastifyApp({ logger: true });

  // RATE LIMITING
  app.register(rateLimit, {
    max: Number(process.env.API_RATE_LIMIT_MAX ?? 120),
    timeWindow: process.env.API_RATE_LIMIT_WINDOW ?? "1 minute",
  });

  // AUTH
  registerAuth(app);
  app.register(authRoutes);

  // PROTOTYPE surface only
  app.register(prototypeRoutes, { prefix: "/prototype" });

  return app;
}
