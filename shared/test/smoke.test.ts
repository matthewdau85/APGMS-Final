import assert from "node:assert/strict";
import { test } from "node:test";

import { maskObject } from "../src/masking";

const SAMPLE = {
  password: "hunter2",
  apiToken: "supersecrettoken",
};

test("smoke: masking helpers redact secrets", () => {
  const masked = maskObject(SAMPLE);
  assert.equal(masked.password, "***redacted***");
  assert.equal(masked.apiToken, "***redacted***");
});
