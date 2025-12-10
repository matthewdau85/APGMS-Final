export type SecretManagerProvider = "env" | "vault";
export interface SecretManager {
    getSecret(identifier: string): Promise<string | undefined>;
}
export declare function createSecretManager(): SecretManager;
//# sourceMappingURL=secret-manager.d.ts.map