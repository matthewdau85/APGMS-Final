const VAULT_PREFIX = "vault://";

export type SecretHydratorOptions = {
  secretManager?: SecretManager;
};

type SecretManager = {
  getSecret(identifier: string): Promise<string | undefined>;
};

async function loadSecretManager(): Promise<SecretManager> {
  const mod = await import("@apgms/shared");
  return mod.createSecretManager();
}

type VaultReference = {
  path: string;
  field?: string;
};

function parseVaultReference(raw: string): VaultReference {
  const withoutPrefix = raw.slice(VAULT_PREFIX.length);
  const [path, field] = withoutPrefix.split("#", 2);
  if (!path) {
    throw new Error(`Vault reference ${raw} is missing a path`);
  }
  return { path, field };
}

async function resolveSecret(
  manager: SecretManager,
  reference: VaultReference,
): Promise<string> {
  const payload = await manager.getSecret(reference.path);
  if (payload === undefined) {
    throw new Error(`Vault secret ${reference.path} not found`);
  }

  if (!reference.field) {
    return payload;
  }

  try {
    const json = JSON.parse(payload) as Record<string, unknown>;
    const value = json[reference.field];
    if (typeof value !== "string") {
      throw new Error("field missing or not a string");
    }
    return value;
  } catch (error) {
    throw new Error(
      `Failed to parse vault payload for ${reference.path}: ${String(error)}`,
    );
  }
}

export async function hydrateEnvFromSecretManager(
  keys: string[],
  options: SecretHydratorOptions = {},
): Promise<void> {
  if ((process.env.SECRETS_PROVIDER ?? "env").toLowerCase() !== "vault") {
    return;
  }

  const manager = options.secretManager ?? (await loadSecretManager());
  const cache = new Map<string, string>();
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw || !raw.startsWith(VAULT_PREFIX)) {
      continue;
    }

    const reference = parseVaultReference(raw);
    let payload = cache.get(reference.path);
    if (!payload) {
      payload = await resolveSecret(manager, { path: reference.path });
      cache.set(reference.path, payload);
    }

    let resolved = payload;
    if (reference.field) {
      resolved = await resolveSecret(
        {
          async getSecret() {
            return payload;
          },
        },
        reference,
      );
    }
    process.env[key] = resolved;
  }
}

export { parseVaultReference };
