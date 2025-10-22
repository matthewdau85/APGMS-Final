import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  importJWK,
  jwtVerify,
  type JWTPayload,
  type JWK,
  type KeyLike,
} from "jose";

const AUDIENCE = process.env.AUTH_AUDIENCE;
const ISSUER = process.env.AUTH_ISSUER;
const JWKS_ENV = process.env.AUTH_JWKS;

const clockToleranceSeconds = Number(process.env.AUTH_CLOCK_TOLERANCE_S ?? "5");

if (!AUDIENCE || !ISSUER || !JWKS_ENV) {
  throw new Error(
    "AUTH_AUDIENCE, AUTH_ISSUER and AUTH_JWKS must be configured for JWT verification",
  );
}

type Role = "admin" | "analyst" | "finance" | "auditor";

export interface Principal {
  id: string;
  orgId: string;
  roles: Role[];
  token: string;
}

interface InternalKey {
  kid: string;
  key: KeyLike;
  alg: string;
}

const keyCache = new Map<string, InternalKey>();

async function loadKeys(): Promise<void> {
  if (keyCache.size > 0) {
    return;
  }
  let parsed: { keys?: JWK[] };
  try {
    parsed = JSON.parse(JWKS_ENV) as { keys?: JWK[] };
  } catch (error) {
    throw new Error("AUTH_JWKS must be valid JSON JWK Set");
  }
  if (!parsed.keys || parsed.keys.length === 0) {
    throw new Error("AUTH_JWKS must contain at least one key");
  }
  await Promise.all(
    parsed.keys.map(async (jwk) => {
      if (!jwk.kid) {
        throw new Error("JWK entries must include a kid");
      }
      if (!jwk.alg) {
        throw new Error(`JWK ${jwk.kid} is missing alg`);
      }
      const key = await importJWK(jwk, jwk.alg);
      keyCache.set(jwk.kid, { kid: jwk.kid, key, alg: jwk.alg });
    }),
  );
}

await loadKeys();

async function resolveKey(kid: string | undefined): Promise<InternalKey> {
  if (!kid) {
    throw new Error("JWT header missing kid");
  }
  const cached = keyCache.get(kid);
  if (!cached) {
    throw new Error(`Unknown kid ${kid}`);
  }
  return cached;
}

function normaliseRoles(raw: unknown): Role[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const roles = raw.filter((value): value is Role => typeof value === "string") as Role[];
  return Array.from(new Set(roles));
}

export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 401, code = "unauthorized") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function verifyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<Principal> {
  const header =
    request.headers.authorization ??
    request.headers["Authorization" as keyof typeof request.headers];

  const value = Array.isArray(header) ? header?.[0] : header;
  if (!value) {
    throw new AuthError("Authorization header missing");
  }
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  if (!match) {
    throw new AuthError("Unsupported authorization scheme");
  }
  const token = match[1];

  let verification;
  try {
    verification = await jwtVerify(token, async (header) => {
      const { kid } = header;
      const key = await resolveKey(kid);
      return key.key;
    }, {
      audience: AUDIENCE,
      issuer: ISSUER,
      clockTolerance: clockToleranceSeconds,
    });
  } catch (error) {
    throw new AuthError("Token verification failed");
  }

  const { payload, protectedHeader } = verification;
  const principal = buildPrincipalFromPayload(payload, protectedHeader.kid, token);
  request.log.debug(
    {
      principal: {
        id: principal.id,
        org: principal.orgId,
        roles: principal.roles,
        kid: protectedHeader.kid,
      },
    },
    "verified principal",
  );

  return principal;
}

function buildPrincipalFromPayload(
  payload: JWTPayload,
  kid: string | undefined,
  token: string,
): Principal {
  const sub = payload.sub;
  const orgId = typeof payload.org === "string" ? payload.org : undefined;
  const roles = normaliseRoles(payload.roles);

  if (!sub || !orgId) {
    throw new AuthError("Token missing required claims");
  }
  if (roles.length === 0) {
    throw new AuthError("Token missing roles claim");
  }

  return {
    id: sub,
    orgId,
    roles,
    token,
  };
}

export function requireRole(
  principal: Principal,
  allowed: ReadonlyArray<Role>,
): void {
  if (allowed.length === 0) {
    return;
  }
  const hasRole = principal.roles.some((role) =>
    allowed.some((allowedRole) => timingSafeEqual(Buffer.from(role), Buffer.from(allowedRole))),
  );
  if (!hasRole) {
    throw new AuthError("Forbidden", 403, "forbidden");
  }
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

