import assert from "node:assert/strict";
import { test } from "node:test";
import { maskValue, maskObject, maskError } from "../src/masking";
import { redactValue, redactError, redactLogPayload } from "../src/redaction";

test("maskValue masks by key patterns and URLs", () => {
  const input = {
    password: "hunter2",
    apiToken: "supersecrettoken",
    nested: { dsn: "postgres://user:pass@host:5432/db" },
    short: "secret",
    number: 42,
    bool: true,
    when: new Date("2025-01-01"),
  };
  const masked = maskObject(input);
  assert.equal(masked.password, "***redacted***");
  assert.equal(masked.apiToken, "***redacted***");
  assert.match(String((masked.nested as any).dsn), /^\w{4}\*+..$/); // masked DSN
  assert.equal(masked.short, "***redacted***");
  assert.equal(masked.number, 42);
  assert.equal(masked.bool, true);
  assert.ok(masked.when instanceof Date);
});

test("maskError redacts stack and cause", () => {
  const err = new Error("Failed with token=abc");
  (err as any).cause = { secret: "abc123" };
  const masked = maskError(err);
  assert.equal(masked.name, "Error");
  assert.ok(!(masked.message as string).includes("abc"));
  assert.ok((masked.stack as string).split("\n").length <= 5);
  assert.equal((masked.cause as any).secret, "***redacted***");
});

test("redactValue scrubs identifiers and secrets recursively", () => {
  const sample = {
    email: "dev@example.com",
    abn: "12 345 678 901",
    tfn: "123 456 789",
    iban: "DE89370400440532013000",
    notes: "contact dev@example.com or use token=supersecret",
    items: [{ cookie: "abcd" }, "plain"],
  };
  const result = redactValue(sample) as Record<string, unknown>;
  assert.ok(!(result.email as string).includes("dev@example.com"));
  assert.ok(!(result.abn as string).replace(/\D/g, "").includes("12345678901"));
  assert.ok(!(result.tfn as string).replace(/\D/g, "").includes("123456789"));
  assert.ok(!(result.iban as string).includes("DE89370400440532013000"));
  assert.ok(!(result.notes as string).includes("token=supersecret"));
  assert.equal((result.items as any)[0].cookie, "***redacted***");
  assert.equal((result.items as any)[1], "plain");
});

test("redactError hides stack and identifiers in message/cause", () => {
  const err = new Error("Email dev@example.com failed with secret token=abc");
  (err as any).cause = { abn: "12 345 678 901" };
  const redacted = redactError(err);
  assert.equal(redacted.stack, "[REDACTED]");
  assert.ok(!(redacted.message as string).includes("dev@example.com"));
  assert.ok(!(redacted.message as string).includes("token=abc"));
  assert.ok(!(String((redacted.cause as any).abn)).includes("12345678901"));
});

test("redactLogPayload handles mixed shapes", () => {
  const payload = [
    { authorization: "Bearer supersecret" },
    "value",
    5,
    { nested: [{ email: "a@b.com" }] },
  ];
  const redacted = redactLogPayload(payload) as any[];
  assert.equal(redacted[0].authorization, "***redacted***");
  assert.equal(redacted[1], "value");
  assert.equal(redacted[2], 5);
  assert.ok(!(redacted[3].nested[0].email as string).includes("a@b.com"));
});
