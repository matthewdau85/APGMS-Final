export type Principal = {
  id: string;
  orgId: string;
  role: string;
};

// Base64url encode JSON principal (no JWT signing).
function base64UrlEncodeJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// This matches your repo’s “Bearer base64url(JSON principal)” approach.
// If you later swap to JWT everywhere, you only update this helper.
export function makeTestBearerToken(p: Principal): string {
  return `Bearer ${base64UrlEncodeJson(p)}`;
}

export function withAuthHeaders(opts: {
  orgId?: string;
  role?: string;
  userId?: string;
  includeBearer?: boolean;
} = {}) {
  const orgId = opts.orgId ?? "org-1";
  const role = opts.role ?? "user";
  const userId = opts.userId ?? "test-user";
  const includeBearer = opts.includeBearer ?? true;

  const headers: Record<string, string> = {
    "x-org-id": orgId,
  };

  if (includeBearer) {
    headers.authorization = makeTestBearerToken({ id: userId, orgId, role });
  }

  return headers;
}
