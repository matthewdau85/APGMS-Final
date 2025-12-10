export type EncryptionEnvelope = {
    alg: "AES-256-GCM";
    iv: string;
    ciphertext: string;
    tag: string;
    key: {
        iv: string;
        ciphertext: string;
        tag: string;
    };
};
export declare function encryptEnvelope(masterKey: Buffer, plaintext: Buffer | string, associatedData?: Buffer | string): EncryptionEnvelope;
export declare function decryptEnvelope(masterKey: Buffer, envelope: EncryptionEnvelope, associatedData?: Buffer | string): Buffer;
export declare function encryptJson<T>(masterKey: Buffer, value: T, associatedData?: Buffer | string): EncryptionEnvelope;
export declare function decryptJson<T>(masterKey: Buffer, envelope: EncryptionEnvelope, associatedData?: Buffer | string): T;
//# sourceMappingURL=envelope.d.ts.map