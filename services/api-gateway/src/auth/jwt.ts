import { createHmac, createVerify, type KeyObject } from "node:crypto";

import { getAdminAuthConfig } from "../config";

export type AdminTokenClaims = {
  [key: string]: unknown;
  sub: string;
  orgId: string;
  role: string;
  email?: string;
  iss: string;
  aud: string | string[];
  exp: number;
};

export class AdminTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminTokenError";
  }
}

function base64UrlDecode(segment: string): Buffer {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded =
    padding === 2
      ? `${normalized}==`
      : padding === 3
        ? `${normalized}=`
        : normalized;
  if (padding === 1) {
    throw new AdminTokenError("invalid token encoding");
  }
  return Buffer.from(padded, "base64");
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function verifySignature(
  algorithm: "HS256" | "RS256",
  signingInput: string,
  signature: string,
  key: Uint8Array | KeyObject
): void {
  if (algorithm === "HS256") {
    if (!(key instanceof Uint8Array) && !(key instanceof Buffer)) {
      throw new AdminTokenError("invalid symmetric key");
    }
    const expected = createHmac("sha256", key).update(signingInput).digest("base64url");
    if (!constantTimeCompare(expected, signature)) {
      throw new AdminTokenError("invalid token signature");
    }
    return;
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(signingInput);
  verifier.end();
  const sigBuffer = base64UrlDecode(signature);
  if (!verifier.verify(key, sigBuffer)) {
    throw new AdminTokenError("invalid token signature");
  }
}

function assertAudience(audClaim: unknown, expected: string): asserts audClaim is string | string[] {
  if (typeof audClaim === "string") {
    if (audClaim !== expected) {
      throw new AdminTokenError("invalid audience");
    }
    return;
  }
  if (Array.isArray(audClaim)) {
    if (!audClaim.includes(expected)) {
      throw new AdminTokenError("invalid audience");
    }
    return;
  }
  throw new AdminTokenError("invalid audience");
}

export async function verifyAdminToken(token: string): Promise<AdminTokenClaims> {
  if (!token) {
    throw new AdminTokenError("token missing");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AdminTokenError("invalid token format");
  }

  let headerJson: string;
  let payloadJson: string;
  try {
    headerJson = base64UrlDecode(parts[0]).toString("utf8");
    payloadJson = base64UrlDecode(parts[1]).toString("utf8");
  } catch (error) {
    throw new AdminTokenError("invalid token encoding");
  }

  let header: { alg?: string; typ?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(headerJson);
    payload = JSON.parse(payloadJson);
  } catch (error) {
    throw new AdminTokenError("invalid token structure");
  }

  const config = getAdminAuthConfig();
  if (!header.alg || header.alg !== config.algorithm) {
    throw new AdminTokenError("unexpected algorithm");
  }

  verifySignature(config.algorithm, `${parts[0]}.${parts[1]}`, parts[2], config.key);

  const issuer = payload.iss;
  if (typeof issuer !== "string" || issuer !== config.issuer) {
    throw new AdminTokenError("invalid issuer");
  }

  const audienceClaim = payload.aud;
  assertAudience(audienceClaim, config.audience);

  const exp = payload.exp;
  if (typeof exp !== "number") {
    throw new AdminTokenError("missing expiry");
  }
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) {
    throw new AdminTokenError("token expired");
  }

  const notBefore = payload.nbf;
  if (typeof notBefore === "number" && notBefore > now) {
    throw new AdminTokenError("token not active");
  }

  const subject = payload.sub;
  if (typeof subject !== "string" || subject.length === 0) {
    throw new AdminTokenError("missing subject");
  }

  const roleClaim = payload.role;
  if (typeof roleClaim !== "string") {
    throw new AdminTokenError("missing role claim");
  }

  const orgId = payload.orgId;
  if (typeof orgId !== "string" || orgId.length === 0) {
    throw new AdminTokenError("missing orgId claim");
  }

  const email = typeof payload.email === "string" ? payload.email : undefined;

  return {
    ...payload,
    sub: subject,
    orgId,
    role: roleClaim,
    email,
    iss: issuer,
    aud: audienceClaim,
    exp,
  } as AdminTokenClaims;
}
