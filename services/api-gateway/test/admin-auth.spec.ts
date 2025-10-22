import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "node:crypto";

import { AdminAuthError, createAdminVerifier, type AdminAuthConfig } from "../src/lib/admin-auth";

const BASE_CONFIG: AdminAuthConfig = {
  issuer: "unit-test-issuer",
  audience: "unit-test-audience",
  secret: "unit-test-secret",
};

describe("admin auth verification", () => {
  it("accepts a valid admin token", () => {
    const verifier = createAdminVerifier(BASE_CONFIG);
    const token = createToken({});
    const claims = verifier.verifyToken(token, { requiredRole: "admin", orgId: "org-1" });
    assert.equal(claims.sub, "admin-user");
    assert.deepEqual(claims.roles, ["admin"]);
  });

  it("rejects tokens with invalid signatures", () => {
    const verifier = createAdminVerifier(BASE_CONFIG);
    const [header, payload, signature] = createToken({}).split(".");
    const tampered = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
    const token = `${header}.${payload}.${tampered}`;
    assert.throws(
      () => verifier.verifyToken(token, { requiredRole: "admin" }),
      (error: unknown) => error instanceof AdminAuthError && error.code === "invalid_signature",
    );
  });

  it("rejects tokens issued by an unexpected issuer", () => {
    const verifier = createAdminVerifier(BASE_CONFIG);
    const token = createToken({ payloadOverrides: { iss: "other-issuer" } });
    assert.throws(
      () => verifier.verifyToken(token, { requiredRole: "admin" }),
      (error: unknown) => error instanceof AdminAuthError && error.code === "invalid_issuer",
    );
  });

  it("rejects revoked tokens", () => {
    const verifier = createAdminVerifier({ ...BASE_CONFIG, revokedTokenIds: ["revoked-id"] });
    const token = createToken({ payloadOverrides: { jti: "revoked-id" } });
    assert.throws(
      () => verifier.verifyToken(token, { requiredRole: "admin" }),
      (error: unknown) => error instanceof AdminAuthError && error.code === "token_revoked",
    );
  });
});

function createToken({
  payloadOverrides = {},
  headerOverrides = {},
}: {
  payloadOverrides?: Record<string, unknown>;
  headerOverrides?: Record<string, unknown>;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT", ...headerOverrides };
  const payload = {
    iss: BASE_CONFIG.issuer,
    aud: BASE_CONFIG.audience,
    sub: "admin-user",
    exp: now + 300,
    roles: ["admin"],
    orgs: ["org-1"],
    ...payloadOverrides,
  };

  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = createHmac("sha256", BASE_CONFIG.secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

