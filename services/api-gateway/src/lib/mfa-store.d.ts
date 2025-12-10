import type { MfaCredential } from "@prisma/client";
export declare function hashRecoveryCode(code: string): string;
export declare function getTotpCredential(userId: string): Promise<{
    secret: string;
    recoveryCodes: Array<{
        hash: string;
        used: boolean;
    }>;
    record: MfaCredential;
} | null>;
export declare function upsertTotpCredential(userId: string, secret: string, recoveryCodes: Array<{
    hash: string;
    used: boolean;
}>): Promise<void>;
export declare function updateTotpRecoveryCodes(credentialId: string, userId: string, secret: string, recoveryCodes: Array<{
    hash: string;
    used: boolean;
}>): Promise<void>;
export declare function recordMfaUsage(credentialId: string): Promise<void>;
export declare function listPasskeyCredentials(userId: string): Promise<MfaCredential[]>;
export declare function savePasskeyCredential(userId: string, credentialId: string, publicKey: Buffer, counter: number): Promise<void>;
export declare function updatePasskeyCounter(credentialId: string, counter: number): Promise<void>;
export declare function decodePasskeyCredential(record: MfaCredential): Promise<{
    publicKey: Buffer;
    counter: number;
}>;
export declare function hasPasskey(userId: string): Promise<boolean>;
export declare function disableTotp(userId: string): Promise<void>;
export declare function hasTotp(userId: string): Promise<boolean>;
//# sourceMappingURL=mfa-store.d.ts.map