import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

import type { SaltMaterial, TokenSaltProvider } from "../pii";

export interface SecretsManagerClientLike {
  send(command: GetSecretValueCommand): Promise<{ SecretString?: string; SecretBinary?: Uint8Array }>;
}

export interface SecretSaltDefinition {
  sid: string;
  secretId: string;
}

export interface SecretsManagerSaltOptions {
  client?: SecretsManagerClientLike;
  secrets: SecretSaltDefinition[];
  activeSaltId: string;
  region?: string;
}

export async function createSecretsManagerSaltProvider(
  options: SecretsManagerSaltOptions,
): Promise<TokenSaltProvider> {
  const { secrets, activeSaltId } = options;
  if (!Array.isArray(secrets) || secrets.length === 0) {
    throw new Error("No token salts configured");
  }

  const client = options.client ?? new SecretsManagerClient({ region: options.region });
  const loadedSalts = new Map<string, Buffer>();

  for (const entry of secrets) {
    if (!entry?.sid || !entry?.secretId) {
      throw new Error("Invalid salt secret definition");
    }

    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: entry.secretId,
      }),
    );

    let secretValue: Buffer | undefined;
    if (response.SecretBinary) {
      secretValue = Buffer.from(response.SecretBinary);
    } else if (response.SecretString) {
      try {
        const parsed = JSON.parse(response.SecretString) as { value?: string } | undefined;
        const value = typeof parsed?.value === "string" ? parsed.value : response.SecretString;
        secretValue = Buffer.from(value, "base64");
      } catch {
        secretValue = Buffer.from(response.SecretString, "base64");
      }
    }

    if (!secretValue) {
      throw new Error(`Secret ${entry.secretId} did not contain usable salt material`);
    }

    loadedSalts.set(entry.sid, secretValue);
  }

  if (!loadedSalts.has(activeSaltId)) {
    throw new Error(`Active salt ${activeSaltId} not present in loaded secrets`);
  }

  function getSaltById(sid: string): SaltMaterial | undefined {
    const secret = loadedSalts.get(sid);
    if (!secret) return undefined;
    return { sid, secret };
  }

  return {
    getActiveSalt(): SaltMaterial {
      const active = getSaltById(activeSaltId);
      if (!active) {
        throw new Error(`Active salt ${activeSaltId} not loaded`);
      }
      return active;
    },
    getSaltById,
  };
}
