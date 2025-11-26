// services/api-gateway/src/utils/orgScope.ts
import type { BankLine } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";

// roles you consider allowed to create/update bank lines
const ALLOWED_ROLES_FOR_BANKLINES = ["owner", "admin", "accountant"] as const;
type AllowedRole = (typeof ALLOWED_ROLES_FOR_BANKLINES)[number];

export function assertOrgAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  targetOrgId: string
): boolean {
  if (!request.user) {
    reply.code(401).send({
      error: { code: "unauthenticated", message: "Authentication required" }
    });
    return false;
  }

  // org mismatch
  if (request.user.orgId !== targetOrgId) {
    reply.code(403).send({
      error: { code: "forbidden_wrong_org", message: "Organisation mismatch" }
    });
    return false;
  }

  return true;
}

export function assertRoleForBankLines(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  if (!request.user) {
    reply.code(401).send({
      error: { code: "unauthenticated", message: "Authentication required" }
    });
    return false;
  }

  const userRole = request.user.role;
  const ok = ALLOWED_ROLES_FOR_BANKLINES.includes(
    userRole as AllowedRole
  );

  if (!ok) {
    reply.code(403).send({
      error: { code: "forbidden_role", message: "Insufficient role for bank lines" }
    });
    return false;
  }

  return true;
}

export type OrgContext = {
  orgId: string;
  actorId: string;
  role: string;
};

function resolveUser(request: FastifyRequest): { orgId?: string; sub?: string; role?: string } | undefined {
  return (request as any).user as { orgId?: string; sub?: string; role?: string } | undefined;
}

export function requireOrgContext(request: FastifyRequest, reply: FastifyReply): OrgContext | null {
  const user = resolveUser(request);
  if (!user?.orgId) {
    reply.code(401).send({
      error: { code: "unauthenticated", message: "Authentication required" }
    });
    return null;
  }
  if (!assertOrgAccess(request, reply, user.orgId)) {
    return null;
  }
  if (!user.role) {
    reply.code(403).send({ error: { code: "forbidden_role", message: "Role missing" } });
    return null;
  }
  return {
    orgId: user.orgId,
    actorId: user.sub ?? "unknown",
    role: user.role,
  };
}

// Redact sensitive fields before sending DB rows out.
// Adjust field names to match your Prisma model.
export function redactBankLine(row: BankLine | null | undefined) {
  if (!row) return row;

  const amountValue = (row as any).amount;
  const amount =
    amountValue && typeof amountValue === "object" && typeof amountValue.toNumber === "function"
      ? amountValue.toNumber()
      : Number(amountValue);

  return {
    id: row.id,
    orgId: row.orgId,
    amount,
    date: row.date,
    createdAt: row.createdAt,
  };
}
