import type { FastifyInstance } from "fastify";

export type Deps = Record<string, never>;

export default async function registerConnectorRoutes(
  app: FastifyInstance,
  _deps: Deps
): Promise<void> {
  app.get("/connectors/health", async () => {
    return { status: "ok", connectors: "stubbed" };
  });
}
