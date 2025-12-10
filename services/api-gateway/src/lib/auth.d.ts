import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
export type Role = "admin" | "analyst" | "finance" | "auditor";
export interface Principal {
    id: string;
    orgId: string;
    roles: Role[];
    token: string;
    mfaEnabled: boolean;
    regulator?: boolean;
    sessionId?: string;
}
export declare class AuthError extends Error {
    readonly statusCode: number;
    readonly code: string;
    constructor(message: string, statusCode?: number, code?: string);
}
type VerifyOptions = {
    audience?: string;
    issuer?: string;
};
export declare function verifyRequest(request: FastifyRequest, reply: FastifyReply, options?: VerifyOptions): Promise<Principal>;
export declare function requireRole(principal: Principal, allowed: ReadonlyArray<Role>): void;
export declare function hashIdentifier(value: string): string;
export declare function authenticateRequest(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, roles: ReadonlyArray<Role>): Promise<Principal | null>;
export {};
//# sourceMappingURL=auth.d.ts.map