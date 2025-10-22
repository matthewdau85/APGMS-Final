import type { FastifyInstance } from "fastify";

import { configurePIIProviders, registerPIIRoutes, type AuditLogger } from "./pii";
import { createSignedAdminGuard } from "./admin-auth";
import {
  createAwsKmsKeyManagementService,
  type AwsKmsClientLike,
  type AwsKmsKeyDefinition,
} from "./providers/aws-kms";
import {
  createSecretsManagerSaltProvider,
  type SecretSaltDefinition,
  type SecretsManagerClientLike,
} from "./providers/secrets-manager";

interface PiiBootstrapOptions {
  kmsClient?: AwsKmsClientLike;
  secretsClient?: SecretsManagerClientLike;
  auditLogger?: AuditLogger;
  region?: string;
}

function parseJson<T>(value: string, name: string): T {
  try {
    const parsed = JSON.parse(value) as T;
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse ${name}: ${(error as Error).message}`);
  }
}

export async function bootstrapPII(app: FastifyInstance, options: PiiBootstrapOptions = {}): Promise<void> {
  const kmsActiveKeyId = process.env.PII_KMS_ACTIVE_KEY_ID;
  const kmsKeyRingRaw = process.env.PII_KMS_KEYS;
  const saltActiveId = process.env.PII_SALT_ACTIVE_ID;
  const saltSecretsRaw = process.env.PII_SALT_SECRETS;

  if (!kmsActiveKeyId || !kmsKeyRingRaw || !saltActiveId || !saltSecretsRaw) {
    app.log.warn("PII providers not fully configured; skipping bootstrap");
    return;
  }

  const kmsKeyRing = parseJson<AwsKmsKeyDefinition[]>(kmsKeyRingRaw, "PII_KMS_KEYS");
  const saltSecrets = parseJson<SecretSaltDefinition[]>(saltSecretsRaw, "PII_SALT_SECRETS");

  const region = options.region ?? process.env.AWS_REGION;

  const [kms, saltProvider] = await Promise.all([
    createAwsKmsKeyManagementService({
      client: options.kmsClient,
      keys: kmsKeyRing,
      activeKeyId: kmsActiveKeyId,
      region,
    }),
    createSecretsManagerSaltProvider({
      client: options.secretsClient,
      secrets: saltSecrets,
      activeSaltId: saltActiveId,
      region,
    }),
  ]);

  const auditLogger: AuditLogger =
    options.auditLogger ??
    ({
      record: async (event) => {
        app.log.info({ audit: event }, "pii_audit_event");
      },
    } satisfies AuditLogger);

  configurePIIProviders({ kms, saltProvider, auditLogger });

  const guard = createSignedAdminGuard();
  registerPIIRoutes(app, guard);

  app.log.info({ activeKey: kmsActiveKeyId, activeSalt: saltActiveId }, "pii providers initialised");
}

