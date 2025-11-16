// services/api-gateway/src/lib/secrets.ts
// Helper for loading secrets from AWS Secrets Manager with env fallback.

import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const region = process.env.AWS_REGION || "ap-southeast-2";
const client = new SecretsManagerClient({ region });

/**
 * Fetch a secret value from AWS Secrets Manager.
 * In non-AWS/non-production environments, falls back to process.env[name].
 */
export async function getSecret(name: string): Promise<string> {
  if (process.env.NODE_ENV !== "production") {
    const envVal = process.env[name];
    if (envVal) return envVal;
  }

  const command = new GetSecretValueCommand({ SecretId: name });
  const res = await client.send(command);
  if (!res.SecretString) {
    throw new Error(`Secret ${name} has no SecretString value`);
  }
  return res.SecretString;
}
