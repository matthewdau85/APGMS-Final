import { test } from "node:test";
import assert from "node:assert/strict";

import { parseRequestBody, ValidationError } from "../src/validation.js";

test("parses valid payloads", () => {
  const payload = {
    requestId: "req-123",
    orgId: "org-1",
    features: {
      payrollVariance: 1.2,
      reconciliationLagDays: 3,
      transactionVolume: 1200,
      alertDensity: 0.4,
    },
    context: { source: "test" },
  };

  assert.deepEqual(parseRequestBody(payload), {
    ...payload,
    requestedAt: undefined,
  });
});

test("throws when a feature is missing", () => {
  const payload: any = {
    requestId: "req-1",
    orgId: "org-1",
    features: {
      payrollVariance: 1.2,
      reconciliationLagDays: 3,
      transactionVolume: 1200,
      alertDensity: "bad",
    },
  };

  assert.throws(() => parseRequestBody(payload), ValidationError);
});
