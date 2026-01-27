import Fastify, { type FastifyInstance } from "fastify";
import { registerAllRoutes } from "./routes/index.js";

export async function buildFastifyApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  // Single authoritative wiring list lives in routes/index.ts
  await registerAllRoutes(app);

  return app;
}

// Also provide a default export so server/import style never drifts again.
export default buildFastifyApp;
