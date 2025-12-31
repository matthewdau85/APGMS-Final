// services/api-gateway/test/helpers/auth.ts
import type { InjectOptions } from "fastify";

type Role = "admin" | "user" | string;

export type TestPrincipal = {
  id: string;
  orgId: string;
  role: Role;
};

function base64urlEncodeUtf8(s: string): string {
  // Node 20+ supports base64url directly.
  return Buffer.from(s, "utf8").toString("base64url");
}

export function makeTestPrincipal(
  overrides: Partial<TestPrincipal> = {}
): TestPrincipal {
  return {
    id: overrides.id ?? "user-1",
    orgId: overrides.orgId ?? "org-1",
    role: overrides.role ?? "admin",
  };
}

export function makePrincipalBearerToken(principal: TestPrincipal): string {
  // Your repo’s convention: Bearer <base64url(JSON)>
  const payload = JSON.stringify(principal);
  return `Bearer ${base64urlEncodeUtf8(payload)}`;
}

export function withAuthHeaders(
  principalOverrides: Partial<TestPrincipal> = {},
  extraHeaders: Record<string, string> = {}
): Record<string, string> {
  const principal = makeTestPrincipal(principalOverrides);
  return {
    "x-org-id": principal.orgId,
    authorization: makePrincipalBearerToken(principal),
    ...extraHeaders,
  };
}

// Convenience for app.inject: merges headers cleanly
export function injectWithAuth(
  base: InjectOptions,
  principalOverrides: Partial<TestPrincipal> = {},
  extraHeaders: Record<string, string> = {}
): InjectOptions {
  const headers = withAuthHeaders(principalOverrides, extraHeaders);
  return {
    ...base,
    headers: {
      ...(base.headers as any),
      ...headers,
    },
  };
}
