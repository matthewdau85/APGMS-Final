import { type EncryptionEnvelope } from "@apgms/shared";
export type { EncryptionEnvelope } from "@apgms/shared";
export declare function sealSecret(value: string, context: string): EncryptionEnvelope;
export declare function unsealSecret(envelope: EncryptionEnvelope, context: string): string;
export declare function sealObject<T>(value: T, context: string): EncryptionEnvelope;
export declare function unsealObject<T>(envelope: EncryptionEnvelope, context: string): T;
//# sourceMappingURL=encryption.d.ts.map