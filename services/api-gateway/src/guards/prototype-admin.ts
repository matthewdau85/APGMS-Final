import type { FastifyReply, FastifyRequest } from "fastify";

type Environment = "development" | "test" | "production";

export type GuardOptions = {
  /**
   * Pass buildFastifyApp({ inMemoryDb: true }) config so the guard doesn't rely on NODE_ENV.
   * (Jest typically forces NODE_ENV="test", which is not the same as config.environment.)
   */
  config?: { environment?: Environment };

  /**
   * Optional hard requirement: a header must be present to even be considered for admin access.
   * Example: requireHeader: "x-prototype-admin"
   */
  requireHeader?: string;

  /**
   * Optional override for admin detection.
   */
  isAdmin?: (req: FastifyRequest) => boolean | Promise<boolean>;

  /**
   * If true (default), prototype admin access is disabled in production (returns 404).
   * This is a backstop even if prototype routes are accidentally registered in prod.
   */
  disableInProduction?: boolean;
};

function resolveEnv(options: GuardOptions): Environment {
  return (options.config?.environment ??
    (process.env.NODE_ENV as Environment) ??
    "development") as Environment;
}

/**
 * Prototype-only guard: ALL prototype routes must be admin-only.
 *
 * Tight posture:
 * - In production: return 404 (surface indistinguishable from “not registered”).
 * - In non-prod: allow convenience mechanisms for tests/dev.
 *
 * Default admin detection:
 * - request.user?.roles includes "admin" OR request.user?.role === "admin"
 * - OR header x-prototype-admin: "1" | "true"
 * - OR header x-admin: "1" | "true"
 * - OR header x-role: "admin"
 * - OR Authorization contains "admin" (prototype/test convenience; not real auth)
 */
export function prototypeAdminGuard(options: GuardOptions = {}) {
  const env = resolveEnv(options);
  const disableInProduction = options.disableInProduction ?? true;
  const isAdmin = options.isAdmin ?? defaultIsAdmin;
  const requiredHeader = options.requireHeader?.toLowerCase();

  return async function prototypeAdminPreHandler(req: FastifyRequest, reply: FastifyReply) {
    // Backstop: even if routes get registered accidentally in production, they are unreachable.
    if (disableInProduction && env === "production") {
      return reply.code(404).send({ error: "Not Found" });
    }

    const enabled = String(process.env.ENABLE_PROTOTYPE ?? "").toLowerCase() === "true";
    if (!enabled) {
      return reply.code(404).send({ error: "Not Found" });
    }

    if (requiredHeader) {
      const present = (req.headers as any)?.[requiredHeader];
      if (!present) {
        return reply.code(403).send({ error: "admin_only_prototype" });
      }
    }

    const ok = await isAdmin(req);
    if (ok) return;

    return reply.code(403).send({ error: "admin_only_prototype" });
  };
}

function defaultIsAdmin(req: FastifyRequest): boolean {
  const user: any = (req as any).user;
  if (user) {
    const roles: unknown = user.roles ?? user.role;
    if (Array.isArray(roles) && roles.includes("admin")) return true;
    if (typeof roles === "string" && roles === "admin") return true;
  }

  return false;
}
