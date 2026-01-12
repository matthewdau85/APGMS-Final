import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerBasRoutes } from "../../src/routes/bas.js";

/**
 * Minimal test app for route-level validation tests.
 * - Registers the BAS routes only.
 * - Decorates request.user (so routes can safely read it).
 * - Injects a simple "test-admin" principal ONLY when an Authorization header is present.
 */
export async function buildTestApp(opts?: {
  orgId?: string;
  userId?: string;
  role?: "admin" | "user";
}): Promise<FastifyInstance> {
  const orgId = opts?.orgId ?? "org_test";
  const userId = opts?.userId ?? "user-test-1";
  const role = opts?.role ?? "admin";

  const app = Fastify({ logger: false });

  // Ensure Fastify knows about request.user (the app normally does this via auth plugin).
  app.decorateRequest("user", null);

  // Route /bas/lodgment does its own auth check AFTER validation,
  // so we only provide a user when an auth header is present.
  app.addHook("preHandler", async (req) => {
    const auth = req.headers.authorization;
    if (!auth) return;

    // Simple, deterministic auth stub for this unit test suite.
    // The route only needs orgId + role (and sub for audit metadata).
    (req as any).user = { sub: userId, orgId, role };
  });

  await registerBasRoutes(app);
  await app.ready();
  return app;
}
