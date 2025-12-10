import type { AuditLogger, KeyManagementService, TokenSaltProvider } from "../lib/pii.js";
export interface ProviderConfig {
    prisma: any;
}
export declare function createKeyManagementService(): Promise<KeyManagementService>;
export declare function createSaltProvider(): Promise<TokenSaltProvider>;
export declare function createAuditLogger(prisma: any): AuditLogger;
//# sourceMappingURL=providers.d.ts.map