// shared/src/security/secret-manager.ts
import assert from "node:assert/strict";
export function createSecretManager() {
    const provider = (process.env.SECRETS_PROVIDER ?? "env").toLowerCase();
    if (provider === "vault") {
        const addr = process.env.VAULT_ADDR;
        const token = process.env.VAULT_TOKEN;
        assert(addr, "VAULT_ADDR is required when SECRETS_PROVIDER=vault");
        assert(token, "VAULT_TOKEN is required when SECRETS_PROVIDER=vault");
        return new VaultSecretManager(addr, token, process.env.VAULT_NAMESPACE);
    }
    return new EnvSecretManager();
}
class EnvSecretManager {
    async getSecret(identifier) {
        return process.env[identifier];
    }
}
class VaultSecretManager {
    constructor(addr, token, namespace) {
        this.addr = addr;
        this.token = token;
        this.namespace = namespace;
    }
    async getSecret(identifier) {
        // allow either a full URL or a KV path
        const path = identifier.startsWith("http")
            ? identifier
            : `${this.addr.replace(/\/$/, "")}/v1/${identifier.replace(/^\//, "")}`;
        const headers = {
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
        const body = (await response.json());
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
function extractVaultData(body) {
    if (!body.data) {
        return undefined;
    }
    // Vault KV v2 returns { data: { data: {...}, metadata: {...} } }
    if (typeof body.data === "object" &&
        body.data !== null &&
        "data" in body.data &&
        typeof body.data.data === "object") {
        return body.data.data;
    }
    return body.data;
}
//# sourceMappingURL=secret-manager.js.map