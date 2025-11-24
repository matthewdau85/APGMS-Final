import assert from "node:assert/strict";
import { test } from "node:test";
import { maskValue, maskObject, maskError } from "../src/masking";
import { redactValue, redactError, redactLogPayload } from "../src/redaction";

test("maskValue masks by key patterns and DSN/URLs while leaving primitives alone", () => {
  const timestamp = new Date("2025-02-01T00:00:00Z");
  const payload = {
    password: "swordfish",
    apiKey: "averyverylongtokenvaluehere",
    database_url: "postgres://user:pass@db:5432/app",
    nested: { token: "short" },
    count: 7,
    ok: false,
    when: timestamp,
  };

  const masked = maskObject(payload) as any;

  assert.equal(masked.password, "***redacted***");
  assert.equal(masked.apiKey, "***redacted***");
  assert.equal(masked.database_url, "***redacted***");
  assert.equal(masked.nested.token, "***redacted***");
  assert.equal(maskValue(5, "number"), 5);
  assert.equal(maskValue(true, "flag"), true);
  assert.strictEqual(maskValue(timestamp, "when"), timestamp);
});

test("maskError redacts stack depth and nested causes", () => {
  const err = new Error("Failed token=abc123");
  err.stack = [
    "Error: Failed token=abc123",
    "    at Object.<anonymous> (file.js:1:1)",
    "    at run (file.js:2:2)",
    "    at step (file.js:3:3)",
    "    at finish (file.js:4:4)",
    "    at end (file.js:5:5)",
  ].join("\n");
  (err as any).cause = { secret: "abc123" };

  const masked = maskError(err);

  assert.ok(typeof masked.stack === "string");
  assert.ok((masked.stack as string).split("\n").length <= 5);
  assert.ok(!(masked.message as string).includes("abc123"));
  assert.equal((masked.cause as any).secret, "***redacted***");
});

test("redactValue scrubs identifiers and secrets recursively", () => {
  const subject = {
    email: "dev@example.com",
    abn: "12 345 678 901",
    tfn: "123 456 789",
    iban: "DE89370400440532013000",
    notes: "Contact dev@example.com with token=supersecret",
    nested: [
      { cookie: "abcd" },
      { items: ["plain", { token: "inner" }] },
    ],
  };

  const redacted = redactValue(subject) as any;

  assert.equal(redacted.email, "[REDACTED:EMAIL]");
  assert.equal(redacted.abn, "[REDACTED:ABN]");
  assert.equal(redacted.tfn, "[REDACTED:TFN]");
  assert.equal(redacted.iban, "[REDACTED:IBAN]");
  assert.ok(!(redacted.notes as string).includes("supersecret"));
  assert.equal(redacted.nested[0].cookie, "***redacted***");
  assert.equal(redacted.nested[1].items[0], "plain");
  assert.equal(redacted.nested[1].items[1].token, "***redacted***");
});

test("redactError hides stack and identifiers in message and cause", () => {
  const err = new Error("Email dev@example.com failed with token=abc");
  (err as any).cause = { abn: "12 345 678 901" };

  const redacted = redactError(err);

  assert.equal(redacted.stack, "[REDACTED]");
  assert.ok(!(redacted.message as string).includes("dev@example.com"));
  assert.ok(!(redacted.message as string).includes("token=abc"));
  assert.equal((redacted.cause as any).abn, "[REDACTED:ABN]");
});

test("redactLogPayload handles mixed shapes", () => {
  const payload = {
    headers: { authorization: "Bearer supersecret" },
    body: [
      { email: "a@b.com" },
      { ok: true, children: [{ tfn: "123 456 789" }] },
    ],
    count: 3,
  };

  const redacted = redactLogPayload(payload) as any;

  assert.equal(redacted.headers.authorization, "***redacted***");
  assert.equal(redacted.body[0].email, "[REDACTED:EMAIL]");
  assert.equal(redacted.body[1].ok, true);
  assert.equal(redacted.body[1].children[0].tfn, "[REDACTED:TFN]");
  assert.equal(redacted.count, 3);
});
