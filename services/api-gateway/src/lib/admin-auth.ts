import { createHmac, timingSafeEqual } from "node:crypto";

import type { FastifyRequest } from "fastify";

const BEARER_PREFIX = "bearer ";

export interface AdminAuthConfig {
  issuer: string;
  audience: string;
  secret: string;
  revokedTokenIds?: Iterable<string>;
  clockSkewSeconds?: number;
}

export interface AdminClaims {
  sub: string;
  roles: string[];
  orgs?: string[];
  iss: string;
  aud: string;
  exp: number;
  jti?: string;
  [key: string]: unknown;
}

export interface VerifyOptions {
  requiredRole?: string;
  orgId?: string;
  now?: number;
}

export interface AdminVerifier {
  verifyToken(token: string, options?: VerifyOptions): AdminClaims;
  verifyRequest(request: FastifyRequest, options?: VerifyOptions): AdminClaims;
}

export class AdminAuthError extends Error {
  override name = "AdminAuthError";

  constructor(public readonly code: string, public readonly statusCode: number, message: string) {
    super(message);
  }
}

export function loadAdminConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AdminAuthConfig {
  const issuer = env.ADMIN_JWT_ISSUER;
  const audience = env.ADMIN_JWT_AUDIENCE;
  const secret = env.ADMIN_JWT_SECRET;

  if (!issuer || !audience || !secret) {
    throw new AdminAuthError(
      "admin_config_missing",
      500,
      "Admin JWT configuration is incomplete. Ensure ADMIN_JWT_ISSUER, ADMIN_JWT_AUDIENCE, and ADMIN_JWT_SECRET are set.",
    );
  }

  const revokedIds = (env.ADMIN_JWT_REVOKED_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const clockSkewSeconds = env.ADMIN_JWT_CLOCK_SKEW ? Number(env.ADMIN_JWT_CLOCK_SKEW) : undefined;

  return {
    issuer,
    audience,
    secret,
    revokedTokenIds: revokedIds,
    clockSkewSeconds,
  };
}

export function createAdminVerifier(config: AdminAuthConfig): AdminVerifier {
  const revoked = new Set(config.revokedTokenIds ?? []);
  const skew = typeof config.clockSkewSeconds === "number" && Number.isFinite(config.clockSkewSeconds)
    ? Math.max(0, config.clockSkewSeconds)
    : 0;

  function verifyToken(token: string, options: VerifyOptions = {}): AdminClaims {
    if (!token) {
      throw new AdminAuthError("missing_token", 401, "Authorization token is required");
    }

    const segments = token.split(".");
    if (segments.length !== 3) {
      throw new AdminAuthError("malformed_token", 401, "Token must be a three-part JWT");
    }

    const [encodedHeader, encodedPayload, encodedSignature] = segments;
    const headerJson = decodeBase64Url(encodedHeader, "header");
    const payloadJson = decodeBase64Url(encodedPayload, "payload");

    let header: { alg?: string; typ?: string };
    let claims: AdminClaims;

    try {
      header = JSON.parse(headerJson);
    } catch (error) {
      throw new AdminAuthError("malformed_header", 401, "Token header is not valid JSON");
    }

    try {
      claims = JSON.parse(payloadJson) as AdminClaims;
    } catch (error) {
      throw new AdminAuthError("malformed_claims", 401, "Token payload is not valid JSON");
    }

    if (header.alg !== "HS256") {
      throw new AdminAuthError("unsupported_algorithm", 401, "Unsupported signing algorithm");
    }

    const expectedSignature = createHmac("sha256", config.secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const providedSignature = base64UrlToBuffer(encodedSignature);

    if (expectedSignature.length !== providedSignature.length) {
      throw new AdminAuthError("invalid_signature", 401, "Token signature mismatch");
    }

    if (!timingSafeEqual(Buffer.from(expectedSignature), providedSignature)) {
      throw new AdminAuthError("invalid_signature", 401, "Token signature mismatch");
    }

    if (claims.iss !== config.issuer) {
      throw new AdminAuthError("invalid_issuer", 403, "Token issuer is not allowed");
    }

    if (claims.aud !== config.audience) {
      throw new AdminAuthError("invalid_audience", 403, "Token audience is not allowed");
    }

    const now = typeof options.now === "number" ? options.now : Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== "number") {
      throw new AdminAuthError("missing_expiration", 401, "Token expiration is required");
    }

    if (claims.exp + skew < now) {
      throw new AdminAuthError("token_expired", 401, "Token has expired");
    }

    if (claims.jti && revoked.has(claims.jti)) {
      throw new AdminAuthError("token_revoked", 403, "Token has been revoked");
    }

    if (options.requiredRole) {
      const roles = Array.isArray(claims.roles) ? claims.roles : [];
      if (!roles.includes(options.requiredRole)) {
        throw new AdminAuthError("insufficient_role", 403, "Token is missing required role");
      }
    }

    if (options.orgId) {
      const { orgs } = claims;
      if (Array.isArray(orgs)) {
        if (!orgs.includes("*") && !orgs.includes(options.orgId)) {
          throw new AdminAuthError("insufficient_scope", 403, "Token is not scoped to the requested organisation");
        }
      } else {
        throw new AdminAuthError("missing_scope", 403, "Token is not scoped for organisation access");
      }
    }

    return claims;
  }

  function verifyRequest(request: FastifyRequest, options: VerifyOptions = {}): AdminClaims {
    const header = request.headers.authorization;
    if (!header) {
      throw new AdminAuthError("missing_authorization", 401, "Authorization header is required");
    }

    const token = extractBearer(header);
    if (!token) {
      throw new AdminAuthError("invalid_authorization", 401, "Authorization header must use the Bearer scheme");
    }

    return verifyToken(token, options);
  }

  return { verifyToken, verifyRequest };
}

export function extractBearer(header: string): string | null {
  const value = header.trim();
  if (value.length === 0) {
    return null;
  }

  if (value.toLowerCase().startsWith(BEARER_PREFIX)) {
    const token = value.slice(BEARER_PREFIX.length).trim();
    return token.length > 0 ? token : null;
  }

  return null;
}

function decodeBase64Url(segment: string, part: string): string {
  try {
    return Buffer.from(segment, "base64url").toString("utf8");
  } catch {
    throw new AdminAuthError(`malformed_${part}`, 401, `Token ${part} is not valid base64url`);
  }
}

function base64UrlToBuffer(segment: string): Buffer {
  try {
    return Buffer.from(segment, "base64url");
  } catch {
    throw new AdminAuthError("malformed_signature", 401, "Token signature is not valid base64url");
  }
}

