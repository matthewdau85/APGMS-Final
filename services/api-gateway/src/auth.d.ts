import { FastifyReply, FastifyRequest } from "fastify";
import { JwtPayload } from "jsonwebtoken";
import { type Principal } from "./lib/auth.js";
export type TokenClaims = JwtPayload & {
    orgId?: string;
    org?: string;
    roles?: string[];
    role?: string;
    regulator?: boolean;
    sessionId?: string;
};
export interface SignTokenOptions {
    audience?: string;
    expiresIn?: string;
    subject?: string;
    extraClaims?: Record<string, unknown>;
}
export interface AuthenticatedUser {
    sub: string;
    orgId: string;
    role: string;
    mfaEnabled: boolean;
    mfaVerified?: boolean;
    regulator?: boolean;
    sessionId?: string;
}
declare module "fastify" {
    interface FastifyRequest {
        user?: AuthenticatedUser;
    }
}
export declare function signToken(user: {
    id: string;
    orgId: string;
    role?: string;
    mfaEnabled?: boolean;
}, options?: SignTokenOptions): Promise<string>;
type GuardValidateFn = (principal: Principal, request: FastifyRequest) => Promise<void> | void;
interface GuardOptions {
    validate?: GuardValidateFn;
}
export declare function createAuthGuard(expectedAudience: string, options?: GuardOptions): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
export declare const authGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
export declare const REGULATOR_AUDIENCE: string;
export declare function verifyCredentials(email: string, pw: string): Promise<{
    id: any;
    orgId: any;
    role: any;
    mfaEnabled: any;
} | null>;
export declare function buildSessionUser(user: {
    id: string;
    orgId: string;
    role?: string | null;
    mfaEnabled?: boolean | null;
}): AuthenticatedUser;
export declare function buildClientUser(user: AuthenticatedUser): {
    id: string;
    orgId: string;
    role: string;
    mfaEnabled: boolean;
};
export {};
//# sourceMappingURL=auth.d.ts.map