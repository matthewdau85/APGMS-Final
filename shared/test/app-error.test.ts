import assert from "node:assert/strict";
import { test } from "node:test";

import { AppError, serializeAppError, type FieldError } from "../src/errors.js";

test("serializeAppError omits optional props when empty", () => {
  const error = new AppError(400, "test.code", "A sample message");
  const payload = serializeAppError(error);
  assert.deepEqual(payload, { code: "test.code", message: "A sample message" });
});

test("serializeAppError preserves metadata and field errors", () => {
  const fields: FieldError[] = [{ path: "body.name", message: "Required" }];
  const metadata = { severity: "error", retryable: false };
  const error = new AppError(422, "test.invalid_name", "Name is required", fields, metadata);
  const payload = serializeAppError(error);
  assert.deepEqual(payload.fields, fields);
  assert.deepEqual(payload.metadata, metadata);
});
