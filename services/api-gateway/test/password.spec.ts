import assert from "node:assert/strict";
import { test } from "node:test";
import argon2 from "argon2";

test("hashing uses argon2id", async () => {
  const hash = await argon2.hash("secret", { type: argon2.argon2id });
  assert.equal(await argon2.verify(hash, "secret"), true);
});
