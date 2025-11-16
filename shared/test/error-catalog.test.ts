import assert from "node:assert/strict";
import { test } from "node:test";

import {
  catalogError,
  ERROR_CATALOG,
  listErrorCatalog,
} from "../src/errors/catalog.js";

import { AppError } from "../src/errors.js";

test("catalogError decorates AppError with metadata", () => {
  const error = catalogError("auth.mfa.passkey.authentication_failed");
  assert.ok(error instanceof AppError);
  assert.equal(error.status, 401);
  assert.equal(error.code, "auth.mfa.passkey.authentication_failed");
  assert.equal(error.message.includes("Passkey authentication"), true);
  assert.deepEqual(error.metadata, {
    domain: "auth",
    remediation: "Ensure the credential still exists and that the browser provided a fresh challenge.",
    retryable: true,
    severity: "error",
  });
});

test("listErrorCatalog exposes all registered entries", () => {
  const entries = listErrorCatalog();
  const codes = new Set(entries.map((entry) => entry.code));
  for (const code of Object.keys(ERROR_CATALOG)) {
    assert.ok(codes.has(code), `missing ${code}`);
  }
});
