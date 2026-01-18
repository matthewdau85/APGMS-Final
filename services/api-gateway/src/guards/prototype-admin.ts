// services/api-gateway/src/guards/prototype-admin.ts
import type { FastifyReply, FastifyRequest } from "fastify";

export type GuardOptions = {
  /**
   * Optional header name that can be used to bypass normal auth in non-prod
   * when ENABLE_PROTOTYPE=true.
   *
   * Example: requireHeader: "x-prototype-admin"
   */
  requireHeader?: string;
};

function isTrueish(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * Prototype admin guard policy:
 * - Production: deny (404/403 should be handled elsewhere; here we forbid)
 * - Non-production:
 *   - If ENABLE_PROTOTYPE=true AND header (default x-prototype-admin) is trueish -> allow
 *   - Else fall back to normal authGuard + admin role if present on app
 */
export function prototypeAdminGuard(options: GuardOptions = {}) {
  const headerName = (options.requireHeader ?? "x-prototype-admin").toLowerCase();

  return async function guard(req: FastifyRequest, reply: FastifyReply) {
    const env = String(process.env.NODE_ENV ?? "development").toLowerCase();
    const enablePrototype = isTrueish(process.env.ENABLE_PROTOTYPE);

    // In production, do not allow prototype surface.
    if (env === "production") {
      return reply.code(403).send({ error: "admin_only_prototype" });
    }

    // Fast path: header-based access for prototype in non-prod (when enabled)
    const hdr = (req.headers as any)[headerName];
    if (enablePrototype && isTrueish(hdr)) {
      return;
    }

    // Fallback: if app has authGuard, enforce it
    const appAny = req.server as any;
    const guardFn =
      (appAny as any).authGuard as
        | ((request: any, response: any) => Promise<void>)
        | undefined;

    if (guardFn) {
      await guardFn(req as any, reply as any);
      if (reply.sent) return;
    }

    const role = String((req as any).user?.role ?? "");
    if (role === "admin") return;

    return reply.code(403).send({ error: "admin_only_prototype" });
  };
}
