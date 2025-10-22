import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertStrongPassword,
  isStrongPassword,
  computeAuditHash,
} from "@apgms/shared";

const FIXED_DATE = new Date("2024-01-01T00:00:00.000Z");

test("isStrongPassword accepts strings with length and complexity", () => {
  assert.equal(isStrongPassword("Supersafe123!"), true);
});

test("isStrongPassword rejects passwords missing complexity", () => {
  assert.equal(isStrongPassword("short"), false);
  assert.equal(isStrongPassword("alllowercasebutlong"), false);
  assert.equal(isStrongPassword("NOLOWERCASE123!"), false);
  assert.equal(isStrongPassword("NoSpecialCharacters1"), false);
});

test("assertStrongPassword throws when requirements not met", () => {
  assert.throws(() => assertStrongPassword("NoSpecialCharacters1"));
});

test("computeAuditHash chains previous hashes for tamper evidence", () => {
  const firstHash = computeAuditHash(null, {
    event: "data_export",
    orgId: "org-1",
    principalId: "admin-1",
    occurredAt: FIXED_DATE,
    payload: { subjectEmail: "user@example.com" },
  });

  const secondHash = computeAuditHash(firstHash, {
    event: "data_delete",
    orgId: "org-1",
    principalId: "admin-1",
    occurredAt: FIXED_DATE,
    payload: { subjectUserId: "user-123", mode: "deleted" },
  });

  assert.notEqual(firstHash, secondHash);
});
