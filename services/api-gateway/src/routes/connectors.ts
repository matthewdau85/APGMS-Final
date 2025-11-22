import type { FastifyInstance } from "fastify";

export interface Deps {
  // TODO: define later
}

export default async function registerConnectorRoutes(
  app: FastifyInstance,
  deps: Deps
): Promise<void> {
  app.get("/connectors/health", async () => {
    return { status: "ok", connectors: "stubbed" };
  });
}
