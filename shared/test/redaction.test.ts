import assert from "node:assert/strict";
import { test } from "node:test";

import { redactValue, redactError, redactLogPayload } from "../src/redaction.js";

test("redactValue removes common identifiers", () => {
  const sample = {
    email: "dev@example.com",
    abn: "12 345 678 901",
    tfn: "123 456 789",
    iban: "DE89370400440532013000",
    accountNumber: "1234567890",
    notes: "contact dev@example.com or use token=supersecret",
  };

  const result = redactValue(sample) as Record<string, string>;

  assert.ok(typeof result.email === "string" && !result.email.includes("dev@example.com"));
  assert.ok(typeof result.abn === "string" && !result.abn.replace(/\D/g, "").includes("12345678901"));
  assert.ok(typeof result.tfn === "string" && !result.tfn.replace(/\D/g, "").includes("123456789"));
  assert.ok(typeof result.iban === "string" && !result.iban.includes("DE89370400440532013000"));
  assert.ok(typeof result.accountNumber === "string" && !result.accountNumber.includes("1234567890"));
  assert.ok(typeof result.notes === "string" && !result.notes.includes("token=supersecret"));
});

test("redactLogPayload masks identifiers inside nested objects", () => {
  const payload = {
    user: { email: "finance@example.com", account: "987654321" },
    message: "TFN 111 222 333 should not leak",
  };

  const masked = redactLogPayload(payload) as any;
  assert.ok(!JSON.stringify(masked).includes("finance@example.com"));
  assert.ok(!JSON.stringify(masked).includes("987654321"));
  assert.ok(!JSON.stringify(masked).includes("111222333"));
});

test("redactError removes stack traces and secrets", () => {
  const err = new Error("Failed with secret token=abc");
  const redacted = redactError(err);

  assert.equal(redacted.stack, "[REDACTED]");
  const message = (redacted.message as string) ?? "";
  assert.ok(!message.includes("token=abc"));
});
