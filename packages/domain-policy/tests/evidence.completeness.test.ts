// packages/domain-policy/tests/evidence.completeness.test.ts

import { validateEvidence } from "../src/export/validateEvidence.js";

test("evidence pack must satisfy completeness rules", () => {
  const invalidEvidence = {} as any;

  expect(() => validateEvidence(invalidEvidence)).toThrow();
});
