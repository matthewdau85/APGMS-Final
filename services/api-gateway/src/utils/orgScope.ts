// services/api-gateway/src/utils/orgScope.ts
import { FastifyReply, FastifyRequest } from "fastify";

// roles you consider allowed to create/update bank lines
const ALLOWED_ROLES_FOR_BANKLINES = ["owner", "admin", "accountant"] as const;
type AllowedRole = (typeof ALLOWED_ROLES_FOR_BANKLINES)[number];

export function assertOrgAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  targetOrgId: string
): boolean {
  if (!request.user) {
    reply.code(401).send({ error: "unauthenticated" });
    return false;
  }

  // org mismatch
  if (request.user.orgId !== targetOrgId) {
    reply.code(403).send({ error: "forbidden_wrong_org" });
    return false;
  }

  return true;
}

export function assertRoleForBankLines(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  if (!request.user) {
    reply.code(401).send({ error: "unauthenticated" });
    return false;
  }

  const userRole = request.user.role;
  const ok = ALLOWED_ROLES_FOR_BANKLINES.includes(
    userRole as AllowedRole
  );

  if (!ok) {
    reply.code(403).send({ error: "forbidden_role" });
    return false;
  }

  return true;
}

// Redact sensitive fields before sending DB rows out.
// Adjust field names to match your Prisma model.
export function redactBankLine(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    orgId: row.orgId,
    amount: Number(row.amount ?? 0),
    postedAt: row.date instanceof Date ? row.date.toISOString() : row.date,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    description: "***",
  };
}
