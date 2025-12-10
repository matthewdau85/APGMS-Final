/**
 * Get a secret from AWS Secrets Manager, with optional env fallback.
 *
 * - key: the SecretId in AWS
 * - fallbackEnv: env var to use when AWS is unavailable
 * - json: parse value as JSON if true
 */
export declare function getSecret(key: string, options?: {
    fallbackEnv?: string;
    json?: boolean;
}): Promise<string | Record<string, unknown> | null>;
//# sourceMappingURL=secrets.d.ts.map