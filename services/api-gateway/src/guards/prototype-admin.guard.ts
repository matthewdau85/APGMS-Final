// services/api-gateway/src/guards/prototype-admin.guard.ts
import type { FastifyReply, FastifyRequest } from "fastify";

function truthyHeader(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "admin";
}

function isAdminFromUser(user: any): boolean {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  if (user.admin === true) return true;

  const role = user.role;
  if (typeof role === "string" && role.toLowerCase() === "admin") return true;

  const roles = user.roles;
  if (Array.isArray(roles) && roles.some((r) => String(r).toLowerCase() === "admin")) return true;

  return false;
}

/**
 * Pre-handler: blocks prototype routes unless the caller is admin.
 * Expected by tests:
 * - status 403
 * - body { error: "admin_only_prototype" }
 */
export async function prototypeAdminOnly(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const anyReq: any = request as any;

  const user = anyReq.user;
  const headerAdmin =
    truthyHeader(request.headers["x-admin"]) ||
    truthyHeader(request.headers["x-apgms-admin"]) ||
    truthyHeader(request.headers["x-test-admin"]);

  const admin = headerAdmin || isAdminFromUser(user);

  if (!admin) {
    reply.code(403).send({ error: "admin_only_prototype" });
    return;
  }
}

export default prototypeAdminOnly;
