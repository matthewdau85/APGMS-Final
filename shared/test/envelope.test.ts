import assert from "node:assert/strict";

import {
  encryptEnvelope,
  decryptEnvelope,
  encryptJson,
  decryptJson,
} from "../src/crypto/envelope.js";

const MASTER_KEY = Buffer.alloc(32, 7);

test("encrypt/decrypt envelope round trips", () => {
  const envelope = encryptEnvelope(MASTER_KEY, "secret payload", "context");
  const plaintext = decryptEnvelope(MASTER_KEY, envelope, "context");
  assert.equal(plaintext.toString("utf8"), "secret payload");
});

test("encrypt/decrypt json round trips", () => {
  const payload = { hello: "world", count: 3 };
  const envelope = encryptJson(MASTER_KEY, payload);
  const decoded = decryptJson<typeof payload>(MASTER_KEY, envelope);
  assert.deepEqual(decoded, payload);
});
