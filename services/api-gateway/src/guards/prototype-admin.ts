import type { FastifyReply, FastifyRequest } from "fastify";

type GuardOptions = {
  isAdmin?: (req: FastifyRequest) => boolean | Promise<boolean>;
};

/**
 * Prototype-only guard: ALL prototype routes must be admin-only.
 *
 * Default admin detection:
 * - request.user?.roles includes "admin" OR request.user?.role === "admin"
 * - OR header x-prototype-admin: "1" | "true"
 * - OR header x-admin: "1" | "true"
 * - OR header x-role: "admin"
 * - OR Authorization contains "admin" (prototype/test convenience)
 */
export function prototypeAdminGuard(options: GuardOptions = {}) {
  const isAdmin = options.isAdmin ?? defaultIsAdmin;

  return async function prototypeAdminPreHandler(req: FastifyRequest, reply: FastifyReply) {
    const ok = await isAdmin(req);
    if (ok) return;

    return reply.code(403).send({
      error: "admin_only_prototype",
    });
  };
}

function defaultIsAdmin(req: FastifyRequest): boolean {
  const user: any = (req as any).user;
  if (user) {
    const roles: unknown = user.roles ?? user.role;
    if (Array.isArray(roles) && roles.includes("admin")) return true;
    if (typeof roles === "string" && roles === "admin") return true;
  }

  const h: any = req.headers ?? {};

  const protoAdmin = String(h["x-prototype-admin"] ?? "").toLowerCase();
  if (protoAdmin === "1" || protoAdmin === "true") return true;

  const xAdmin = String(h["x-admin"] ?? "").toLowerCase();
  if (xAdmin === "1" || xAdmin === "true") return true;

  const xRole = String(h["x-role"] ?? "").toLowerCase();
  if (xRole === "admin") return true;

  const auth = String(h["authorization"] ?? "").toLowerCase();
  if (auth.includes("admin")) return true;

  return false;
}
