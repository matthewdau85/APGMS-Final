// services/api-gateway/src/utils/orgScope.ts
import type { FastifyReply, FastifyRequest } from "fastify";

export type OrgContext = {
  orgId: string;
  actorId: string; // required (audit requires string)
};

export function enforceOrgScope(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
): boolean {
  const user = request.user as any;

  if (!user) {
    reply.code(401).send({ error: { code: "unauthorized", message: "Missing user" } });
    return false;
  }

  const role = String(user.role || "");
  if (!role) {
    reply.code(403).send({ error: { code: "forbidden_role", message: "Role missing" } });
    return false;
  }

  // Admin bypass for org scope checks
  if (role === "admin") return true;

  const userOrgId = String(user.orgId || "");
  if (!userOrgId || userOrgId !== orgId) {
    reply.code(403).send({
      error: { code: "forbidden_org", message: "User not permitted for this org" },
    });
    return false;
  }

  return true;
}

// Back-compat: routes import assertOrgAccess(...)
export function assertOrgAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string,
): boolean {
  return enforceOrgScope(request, reply, orgId);
}

// Back-compat: transfers route expects ctx.orgId + ctx.actorId
export function requireOrgContext(request: FastifyRequest, reply: FastifyReply): OrgContext {
  const headerOrg = (request.headers as any)["x-org-id"];
  const user = request.user as any;

  const orgId = String(headerOrg || user?.orgId || "");
  const actorId = String(user?.sub || user?.actorId || "system");

  if (!orgId) {
    reply.code(400).send({
      error: { code: "missing_org", message: "Missing org context (x-org-id header or user.orgId)" },
    });
    throw new Error("missing_org_context");
  }

  return { orgId, actorId };
}
