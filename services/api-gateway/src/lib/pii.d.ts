import type { FastifyInstance, FastifyRequest } from "fastify";
export interface EncryptionKey {
    kid: string;
    material: Buffer;
}
export interface KeyManagementService {
    getActiveKey(): EncryptionKey;
    getKeyById(kid: string): EncryptionKey | undefined;
}
export interface SaltMaterial {
    sid: string;
    secret: Buffer;
}
export interface TokenSaltProvider {
    getActiveSalt(): SaltMaterial;
    getSaltById(id: string): SaltMaterial | undefined;
}
export interface AuditEvent {
    actorId: string;
    action: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
export interface AuditLogger {
    record(event: AuditEvent): void | Promise<void>;
}
interface PIIContext {
    kms: KeyManagementService;
    saltProvider: TokenSaltProvider;
    auditLogger: AuditLogger;
}
export declare function configurePIIProviders(newContext: PIIContext): void;
export declare function tokenizeTFN(plain: string): string;
export declare function encryptPII(plain: string): {
    ciphertext: string;
    kid: string;
};
export declare function decryptPII(payload: {
    ciphertext: string;
    kid: string;
}): string;
export interface AdminGuardResult {
    allowed: boolean;
    actorId: string;
}
export type AdminGuard = (request: FastifyRequest) => Promise<AdminGuardResult> | AdminGuardResult;
export declare function registerPIIRoutes(app: FastifyInstance, guard: AdminGuard): void;
export {};
//# sourceMappingURL=pii.d.ts.map