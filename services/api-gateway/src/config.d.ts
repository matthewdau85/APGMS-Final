import { Buffer } from "node:buffer";
export interface AppConfig {
    readonly env: "local" | "test" | "development" | "staging" | "production";
    readonly databaseUrl: string;
    readonly shadowDatabaseUrl?: string;
    readonly rateLimit: {
        readonly max: number;
        readonly window: string;
    };
    readonly security: {
        readonly authFailureThreshold: number;
        readonly kmsKeysetLoaded?: boolean;
        readonly requireHttps: boolean;
        readonly enableIsolation?: boolean;
    };
    readonly cors: {
        readonly allowedOrigins: string[];
    };
    readonly taxEngineUrl: string;
    readonly auth: {
        readonly audience: string;
        readonly issuer: string;
        readonly devSecret: string;
    };
    readonly regulator: {
        readonly accessCode: string;
        readonly jwtAudience: string;
        readonly sessionTtlMinutes: number;
    };
    readonly encryption: {
        readonly masterKey: Buffer;
    };
    readonly webauthn: {
        readonly rpId: string;
        readonly rpName: string;
        readonly origin: string;
    };
    readonly banking: {
        readonly providerId: string;
        readonly maxReadTransactions: number;
        readonly maxWriteCents: number;
    };
    readonly redis?: {
        readonly url: string;
    };
    readonly nats?: {
        readonly url: string;
        readonly token?: string;
        readonly username?: string;
        readonly password?: string;
    };
}
export declare function loadConfig(): AppConfig;
export declare const config: AppConfig;
//# sourceMappingURL=config.d.ts.map