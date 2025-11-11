// services/api-gateway/src/utils/orgScope.ts
import { FastifyReply, FastifyRequest } from "fastify";

import type { Role } from "../lib/auth.js";

// Roles permitted to view or mutate /bank-lines resources.
const ALLOWED_ROLES_FOR_BANKLINES: ReadonlyArray<Role> = ["admin", "finance", "analyst"];

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

  const userRole = request.user.role as Role | undefined;
  const ok = !!userRole && ALLOWED_ROLES_FOR_BANKLINES.includes(userRole);

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
    // safe fields:
    accountRef: row.accountRef,
    amountCents: row.amountCents,
    currency: row.currency,
    createdAt: row.createdAt,
    // hide or mask anything sensitive:
    // e.g. bankAccountNumber, taxFileNumber, rawNarrative, etc
  };
}
