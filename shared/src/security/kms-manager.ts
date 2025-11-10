import { createHash } from "node:crypto";
import assert from "node:assert/strict";

import {
  encryptJson,
  decryptJson,
  type EncryptionEnvelope,
} from "../crypto/envelope.js";

export type KmsKeyAlias = string;

export interface KmsKeyConfig {
  /**
   * External identifier for the backing KMS key. Included in envelopes and
   * surfaced in audit events so the platform can track which hardware module
   * wrapped the data key.
   */
  keyId: string;
  /**
   * Optional base64 encoded key material for local development or integration
   * tests. Production deployments resolve the material from a managed
   * keystore, so omitting this value will derive the secret from the alias in a
   * deterministic way to keep fixtures stable.
   */
  material?: string;
}

export interface EncryptOptions<TContext extends Record<string, string>> {
  alias: KmsKeyAlias;
  context: TContext;
  payload: unknown;
}

export interface EncryptionRecord<TContext extends Record<string, string>> {
  keyId: string;
  alias: KmsKeyAlias;
  algorithm: "AES-256-GCM";
  context: TContext;
  envelope: EncryptionEnvelope;
}

function decodeMaterial(alias: string, config: KmsKeyConfig): Buffer {
  if (config.material) {
    const material = Buffer.from(config.material, "base64");
    assert.equal(
      material.length,
      32,
      `KMS material for ${alias} must be 32 bytes of base64 data`,
    );
    return material;
  }

  const fallback = createHash("sha256")
    .update(`fallback:${alias}:${config.keyId}`)
    .digest();
  return fallback;
}

function buildAssociatedData(
  alias: KmsKeyAlias,
  context: Record<string, string>,
): Buffer {
  const sortedEntries = Object.entries(context)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  const serialized = JSON.stringify({ alias, context: sortedEntries });
  return Buffer.from(serialized, "utf8");
}

export class KmsKeyManager {
  private readonly material = new Map<KmsKeyAlias, Buffer>();
  private readonly configs = new Map<KmsKeyAlias, KmsKeyConfig>();

  constructor(configs: Record<KmsKeyAlias, KmsKeyConfig>) {
    for (const [alias, config] of Object.entries(configs)) {
      this.configs.set(alias, config);
      this.material.set(alias, decodeMaterial(alias, config));
    }
  }

  encrypt<TContext extends Record<string, string>>(
    options: EncryptOptions<TContext>,
  ): EncryptionRecord<TContext> {
    const config = this.configs.get(options.alias);
    if (!config) {
      throw new Error(`Unknown KMS key alias '${options.alias}'`);
    }

    const key = this.material.get(options.alias);
    if (!key) {
      throw new Error(`KMS key material missing for alias '${options.alias}'`);
    }

    const aad = buildAssociatedData(options.alias, options.context);
    const envelope = encryptJson(key, options.payload, aad);

    return {
      keyId: config.keyId,
      alias: options.alias,
      algorithm: "AES-256-GCM",
      context: options.context,
      envelope,
    };
  }

  decrypt<TPayload, TContext extends Record<string, string>>(
    alias: KmsKeyAlias,
    record: EncryptionRecord<TContext>,
  ): TPayload {
    if (record.alias !== alias) {
      throw new Error(
        `Envelope alias mismatch. Expected '${alias}' but received '${record.alias}'`,
      );
    }

    const config = this.configs.get(alias);
    if (!config) {
      throw new Error(`Unknown KMS key alias '${alias}'`);
    }

    if (record.keyId !== config.keyId) {
      throw new Error(
        `Envelope keyId '${record.keyId}' does not match configured key '${config.keyId}'`,
      );
    }

    const key = this.material.get(alias);
    if (!key) {
      throw new Error(`KMS key material missing for alias '${alias}'`);
    }

    const aad = buildAssociatedData(alias, record.context);
    return decryptJson<TPayload>(key, record.envelope, aad);
  }

  rotate<TContext extends Record<string, string>>(
    record: EncryptionRecord<TContext>,
  ): EncryptionRecord<TContext> {
    return this.encrypt({
      alias: record.alias,
      context: record.context,
      payload: this.decrypt(record.alias, record),
    });
  }
}

export function buildDefaultKmsManager(): KmsKeyManager {
  const configs: Record<KmsKeyAlias, KmsKeyConfig> = {
    connectors: {
      keyId: process.env.KMS_CONNECTOR_KEY_ID ?? "kms/connector-default",
      material: process.env.KMS_CONNECTOR_KEY_MATERIAL,
    },
    designatedArtifacts: {
      keyId: process.env.KMS_DESIGNATED_KEY_ID ?? "kms/designated-artifacts",
      material: process.env.KMS_DESIGNATED_KEY_MATERIAL,
    },
  };

  return new KmsKeyManager(configs);
}

export type { EncryptionEnvelope } from "../crypto/envelope.js";
