import type { BankLine } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
export declare function assertOrgAccess(request: FastifyRequest, reply: FastifyReply, targetOrgId: string): boolean;
export declare function assertRoleForBankLines(request: FastifyRequest, reply: FastifyReply): boolean;
export type OrgContext = {
    orgId: string;
    actorId: string;
    role: string;
};
export declare function requireOrgContext(request: FastifyRequest, reply: FastifyReply): OrgContext | null;
export declare function redactBankLine(row: BankLine | null | undefined): any;
//# sourceMappingURL=orgScope.d.ts.map