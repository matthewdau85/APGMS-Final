// roles you consider allowed to create/update bank lines
const ALLOWED_ROLES_FOR_BANKLINES = ["owner", "admin", "accountant"];
export function assertOrgAccess(request, reply, targetOrgId) {
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
export function assertRoleForBankLines(request, reply) {
    if (!request.user) {
        reply.code(401).send({ error: "unauthenticated" });
        return false;
    }
    const userRole = request.user.role;
    const ok = ALLOWED_ROLES_FOR_BANKLINES.includes(userRole);
    if (!ok) {
        reply.code(403).send({ error: "forbidden_role" });
        return false;
    }
    return true;
}
// Redact sensitive fields before sending DB rows out.
// Adjust field names to match your Prisma model.
export function redactBankLine(row) {
    if (!row)
        return row;
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
