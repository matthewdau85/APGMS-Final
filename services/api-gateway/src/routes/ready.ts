// services/api-gateway/src/routes/ready.ts
import type { FastifyInstance } from "fastify";

function nowUtcIso(): string {
  return new Date().toISOString();
}

export default async function readyRoutes(app: FastifyInstance) {
  const payload = () => ({
    ok: true,
    service: "api-gateway",
    time_utc: nowUtcIso(),
  });

  app.get("/ready", async () => payload());
  app.get("/health", async () => payload());
  app.get("/healthz", async () => payload());
}
