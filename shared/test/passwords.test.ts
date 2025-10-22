import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PASSWORD_VERSION,
  hashPassword,
  markPasswordDeleted,
  verifyPasswordHash,
  verifyUserPassword,
} from "../src/passwords";

describe("password helpers", () => {
  it("hashes passwords using argon2-style format", async () => {
    const hashed = await hashPassword("hunter2");
    assert.ok(hashed.startsWith("$argon2"));
    assert.equal(await verifyPasswordHash(hashed, "hunter2"), true);
  });

  it("verifies stored argon2 hashes", async () => {
    const hash = await hashPassword("s3cret!");
    const record = { password: hash, passwordVersion: PASSWORD_VERSION };
    const valid = await verifyUserPassword(record, "s3cret!");
    assert.equal(valid, true);
  });

  it("upgrades legacy plaintext passwords on successful verification", async () => {
    const record = {
      password: "legacy-pass",
      passwordVersion: null as number | null,
    };

    let updatedHash: string | null = null;
    let updatedVersion: number | null = null;
    const result = await verifyUserPassword(record, "legacy-pass", {
      onUpgrade: async ({ hash, version }) => {
        updatedHash = hash;
        updatedVersion = version;
      },
    });

    assert.equal(result, true);
    assert.ok(updatedHash && updatedHash.startsWith("$argon2"));
    assert.equal(updatedVersion, PASSWORD_VERSION);
  });

  it("marks deleted passwords as invalid", () => {
    const deleted = markPasswordDeleted();
    assert.equal(deleted.password, "__deleted__");
    assert.equal(deleted.passwordVersion, null);
  });
});
