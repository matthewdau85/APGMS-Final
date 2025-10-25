import assert from "node:assert/strict";

export type SecretManagerProvider = "env" | "vault";

export interface SecretManager {
  getSecret(identifier: string): Promise<string | undefined>;
}

export function createSecretManager(): SecretManager {
  const provider = (process.env.SECRETS_PROVIDER ?? "env").toLowerCase() as SecretManagerProvider;
  if (provider === "vault") {
    const addr = process.env.VAULT_ADDR;
    const token = process.env.VAULT_TOKEN;
    assert(addr, "VAULT_ADDR is required when SECRETS_PROVIDER=vault");
    assert(token, "VAULT_TOKEN is required when SECRETS_PROVIDER=vault");
    return new VaultSecretManager(addr, token, process.env.VAULT_NAMESPACE);
  }
  return new EnvSecretManager();
}

class EnvSecretManager implements SecretManager {
  async getSecret(identifier: string): Promise<string | undefined> {
    return process.env[identifier];
  }
}

class VaultSecretManager implements SecretManager {
  constructor(
    private readonly addr: string,
    private readonly token: string,
    private readonly namespace?: string,
  ) {}

  async getSecret(identifier: string): Promise<string | undefined> {
    const path = identifier.startsWith("http") ? identifier : `${this.addr.replace(/\/$/, "")}/v1/${identifier.replace(/^\//, "")}`;
    const headers: Record<string, string> = {
      "X-Vault-Token": this.token,
    };
    if (this.namespace) {
      headers["X-Vault-Namespace"] = this.namespace;
    }
    const response = await fetch(path, { headers });
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`Failed to read secret from vault at ${identifier}: ${response.statusText}`);
    }
    const body = (await response.json()) as { data?: unknown };
    const payload = extractVaultData(body);
    if (payload === undefined) {
      return undefined;
    }
    if (typeof payload === "string") {
      return payload;
    }
    return JSON.stringify(payload);
  }
}

function extractVaultData(body: { data?: unknown }): unknown {
  if (!body.data) {
    return undefined;
  }
  // kv v2 nests data.data
  if (
    typeof body.data === "object" &&
    body.data !== null &&
    "data" in (body.data as Record<string, unknown>) &&
    typeof (body.data as Record<string, unknown>).data === "object"
  ) {
    return (body.data as Record<string, unknown>).data;
  }
  return body.data;
}
