import { DecryptCommand, KMSClient } from "@aws-sdk/client-kms";

import type { EncryptionKey, KeyManagementService } from "../pii";

export interface AwsKmsClientLike {
  send(command: DecryptCommand): Promise<{ Plaintext?: Uint8Array | undefined }>;
}

export interface AwsKmsKeyDefinition {
  kid: string;
  ciphertext: string;
}

export interface AwsKmsOptions {
  client?: AwsKmsClientLike;
  keys: AwsKmsKeyDefinition[];
  activeKeyId: string;
  region?: string;
}

export async function createAwsKmsKeyManagementService(options: AwsKmsOptions): Promise<KeyManagementService> {
  const { keys, activeKeyId } = options;
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error("No KMS keys configured");
  }

  const client = options.client ?? new KMSClient({ region: options.region });

  const decryptedKeys = new Map<string, Buffer>();

  for (const entry of keys) {
    if (!entry?.kid || !entry?.ciphertext) {
      throw new Error("Invalid KMS key definition");
    }
    const ciphertext = Buffer.from(entry.ciphertext, "base64");
    const response = await client.send(
      new DecryptCommand({
        CiphertextBlob: ciphertext,
      }),
    );
    if (!response.Plaintext) {
      throw new Error(`KMS did not return plaintext for key ${entry.kid}`);
    }
    const material = Buffer.from(response.Plaintext);
    if (material.length !== 32) {
      throw new Error(`Invalid key length for ${entry.kid}; expected 32 bytes`);
    }
    decryptedKeys.set(entry.kid, material);
  }

  if (!decryptedKeys.has(activeKeyId)) {
    throw new Error(`Active key ${activeKeyId} not present in decrypted key set`);
  }

  function getKeyById(kid: string): EncryptionKey | undefined {
    const material = decryptedKeys.get(kid);
    if (!material) return undefined;
    return { kid, material };
  }

  return {
    getActiveKey(): EncryptionKey {
      const active = getKeyById(activeKeyId);
      if (!active) {
        throw new Error(`Active key ${activeKeyId} not loaded`);
      }
      return active;
    },
    getKeyById,
  };
}
