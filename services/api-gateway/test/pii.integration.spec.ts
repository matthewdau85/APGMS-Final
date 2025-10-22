import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { randomBytes } from "node:crypto";

import type { DecryptCommand } from "@aws-sdk/client-kms";
import type { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import type { FastifyInstance } from "fastify";

import { createApp } from "../src/app";
import { encryptPII } from "../src/lib/pii";
import type { AwsKmsClientLike } from "../src/lib/providers/aws-kms";
import type { SecretsManagerClientLike } from "../src/lib/providers/secrets-manager";
import type { AuditEvent, AuditLogger } from "../src/lib/pii";

class StubKmsClient implements AwsKmsClientLike {
  constructor(private readonly keys: Map<string, Buffer>) {}

  async send(command: DecryptCommand) {
    const blob = command.input.CiphertextBlob;
    if (!blob) {
      throw new Error("CiphertextBlob missing");
    }
    const lookup = Buffer.from(blob as Uint8Array).toString("base64");
    const material = this.keys.get(lookup);
    if (!material) {
      throw new Error(`Unknown ciphertext ${lookup}`);
    }
    return { Plaintext: material };
  }
}

class StubSecretsClient implements SecretsManagerClientLike {
  constructor(private readonly secrets: Map<string, Buffer>) {}

  async send(command: GetSecretValueCommand) {
    const id = command.input.SecretId;
    if (!id) {
      throw new Error("SecretId missing");
    }
    const value = this.secrets.get(id);
    if (!value) {
      throw new Error(`Secret ${id} not found`);
    }
    return { SecretString: JSON.stringify({ value: value.toString("base64") }) };
  }
}

describe("PII bootstrap integration", () => {
  const envKeys = [
    "PII_KMS_ACTIVE_KEY_ID",
    "PII_KMS_KEYS",
    "PII_SALT_ACTIVE_ID",
    "PII_SALT_SECRETS",
    "ADMIN_TOKEN",
  ] as const;

  const previousEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};
  let app: FastifyInstance;
  let auditEvents: AuditEvent[];

  beforeEach(async () => {
    for (const key of envKeys) {
      previousEnv[key] = process.env[key];
    }

    const encryptionKey = randomBytes(32);
    const saltSecret = randomBytes(32);
    const ciphertext = Buffer.from("test-ciphertext", "utf8");

    const kmsClient = new StubKmsClient(new Map([[ciphertext.toString("base64"), encryptionKey]]));
    const secretsClient = new StubSecretsClient(new Map([["arn:aws:secrets:region:acct:secret/pii", saltSecret]]));

    process.env.PII_KMS_ACTIVE_KEY_ID = "pii-key-v1";
    process.env.PII_KMS_KEYS = JSON.stringify([
      { kid: "pii-key-v1", ciphertext: ciphertext.toString("base64") },
    ]);
    process.env.PII_SALT_ACTIVE_ID = "salt-v1";
    process.env.PII_SALT_SECRETS = JSON.stringify([
      { sid: "salt-v1", secretId: "arn:aws:secrets:region:acct:secret/pii" },
    ]);
    process.env.ADMIN_TOKEN = "signed-admin-token";

    auditEvents = [];
    const auditLogger: AuditLogger = {
      record: async (event) => {
        auditEvents.push(event);
      },
    };

    app = await createApp({
      pii: {
        kmsClient,
        secretsClient,
        auditLogger,
      },
    });

    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousEnv[key];
      }
    }
    auditEvents = [];
  });

  it("decrypts payloads using the configured AWS providers", async () => {
    const secret = encryptPII("pii-payload");

    const response = await app.inject({
      method: "POST",
      url: "/admin/pii/decrypt",
      headers: { "x-admin-token": "signed-admin-token" },
      payload: secret,
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { value: string };
    assert.equal(body.value, "pii-payload");

    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0].action, "pii.decrypt");
    assert.equal(auditEvents[0].actorId.startsWith("admin:"), true);
    assert.equal(auditEvents[0].metadata?.kid, secret.kid);
  });
});
