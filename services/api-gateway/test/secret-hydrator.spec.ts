import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hydrateEnvFromSecretManager, parseVaultReference } from "../src/lib/secret-hydrator.js";

describe("secret hydrator", () => {
  it("parses vault references", () => {
    const ref = parseVaultReference("vault://kv/data/apgms#DATABASE_URL");
    assert.equal(ref.path, "kv/data/apgms");
    assert.equal(ref.field, "DATABASE_URL");
  });

  it("hydrates matching environment variables", async () => {
    const envKeys = ["DATABASE_URL", "AUTH_DEV_SECRET"];
    process.env.SECRETS_PROVIDER = "vault";
    process.env.DATABASE_URL = "vault://kv/data/apgms#DATABASE_URL";
    process.env.AUTH_DEV_SECRET = "vault://kv/data/apgms#AUTH_DEV_SECRET";

    const captured: string[] = [];
    await hydrateEnvFromSecretManager(envKeys, {
      secretManager: {
        async getSecret(identifier: string) {
          captured.push(identifier);
          return JSON.stringify({
            DATABASE_URL: "postgres://vault", 
            AUTH_DEV_SECRET: "vault-secret",
          });
        },
      },
    });

    assert.deepEqual(captured, ["kv/data/apgms"]);
    assert.equal(process.env.DATABASE_URL, "postgres://vault");
    assert.equal(process.env.AUTH_DEV_SECRET, "vault-secret");
  });
});
