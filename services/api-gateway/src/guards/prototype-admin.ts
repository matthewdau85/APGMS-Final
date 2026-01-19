// services/api-gateway/src/guards/prototype-admin.ts
import type { FastifyReply, FastifyRequest } from "fastify";

export type GuardOptions = {
  /**
   * Optional header name to allow prototype-admin access.
   * Default: "x-prototype-admin"
   */
  requireHeader?: string;

  /**
   * If true (default), prototype access is disabled when NODE_ENV=production
   * (returns 404), even if routes are accidentally registered.
   */
  disableInProduction?: boolean;
};

/**
 * Prototype-only guard: ALL prototype/demo routes must be admin-only.
 *
 * This is intentionally lightweight for local/prototype flows:
 * - require header x-prototype-admin: "1" | "true"
 *
 * Returns:
 * - 404 { error: "not_found" } if disabled in production or ENABLE_PROTOTYPE not true
 * - 403 { error: "admin_only_prototype" } if missing/invalid header
 */
export function prototypeAdminGuard(options: GuardOptions = {}) {
  const requireHeader = options.requireHeader ?? "x-prototype-admin";
  const disableInProduction = options.disableInProduction !== false;

  return async function prototypeAdminPreHandler(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const env = String(process.env.NODE_ENV ?? "").toLowerCase();
    if (disableInProduction && env === "production") {
      reply.code(404).send({ error: "not_found" });
      return;
    }

    const enabled = String(process.env.ENABLE_PROTOTYPE ?? "").toLowerCase() === "true";
    if (!enabled) {
      reply.code(404).send({ error: "not_found" });
      return;
    }

    const raw = String((req.headers as any)[requireHeader] ?? "").toLowerCase();
    const ok = raw === "1" || raw === "true";
    if (!ok) {
      reply.code(403).send({ ok: false, error: "admin_only_prototype" });
      return;
    }
  };
}

export default prototypeAdminGuard;
