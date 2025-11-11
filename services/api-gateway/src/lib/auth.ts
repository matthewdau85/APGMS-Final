import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import {
  importJWK,
  jwtVerify,
  type JWTPayload,
  type JWK,
} from "jose";

const clockToleranceSeconds = Number(process.env.AUTH_CLOCK_TOLERANCE_S ?? "5");

export type Role = "admin" | "analyst" | "finance" | "auditor";

export interface Principal {
  id: string;
  orgId: string;
  roles: Role[];
  token: string;
  mfaEnabled: boolean;
  regulator?: boolean;
}

interface InternalKey {
  kid: string;
  key: unknown;
  alg: string;
}

const keyCache = new Map<string, InternalKey>();

export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 401, code = "unauthorized") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function loadKeys(): Promise<void> {
  if (keyCache.size > 0) {
    return;
  }
  const jwksEnv = process.env.AUTH_JWKS;
  if (!jwksEnv || jwksEnv.trim().length === 0) {
    return;
  }
  let parsed: { keys?: JWK[] };
  try {
    parsed = JSON.parse(jwksEnv) as { keys?: JWK[] };
  } catch (error) {
    throw new AuthError("Invalid JWT key set", 500, "jwt_config_invalid");
  }
  if (!parsed.keys || parsed.keys.length === 0) {
    throw new AuthError("JWT key set is empty", 500, "jwt_config_invalid");
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

type VerifyOptions = {
  audience?: string;
  issuer?: string;
};

export async function verifyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  options?: VerifyOptions,
): Promise<Principal> {
  const header =
    request.headers.authorization ??
    request.headers["Authorization" as keyof typeof request.headers];

  const audience = options?.audience ?? process.env.AUTH_AUDIENCE;
  const issuer = options?.issuer ?? process.env.AUTH_ISSUER;
  if (!audience || !issuer) {
    throw new AuthError("JWT configuration missing", 500, "jwt_config_missing");
  }

  await loadKeys();

  const value = Array.isArray(header) ? header?.[0] : header;
  if (!value) {
    throw new AuthError("Authorization header missing");
  }
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  if (!match) {
    throw new AuthError("Unsupported authorization scheme");
  }
  const token = match[1];

  const hasJwks = keyCache.size > 0;
  let payload: JWTPayload;
  let kid: string | undefined;

  if (hasJwks) {
    let verification;
    try {
      verification = await jwtVerify(token, async (header) => {
        const { kid: headerKid } = header;
        const key = await resolveKey(headerKid);
        kid = headerKid;
        return key.key as any;
      }, {
        audience,
        issuer,
        clockTolerance: clockToleranceSeconds,
      });
    } catch (error) {
      throw new AuthError("Token verification failed");
    }
    payload = verification.payload;
  } else {
    const secret = process.env.AUTH_DEV_SECRET;
    if (!secret) {
      throw new AuthError("Auth secret missing", 500, "auth_secret_missing");
    }
    try {
      payload = jwt.verify(token, secret, {
        audience,
        issuer,
        clockTolerance: clockToleranceSeconds,
      }) as JWTPayload;
    } catch (error) {
      throw new AuthError("Token verification failed");
    }
  }

  const principal = buildPrincipalFromPayload(payload, kid, token);
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
  const mfaEnabled = payload.mfaEnabled === true;
  const regulator = payload.regulator === true;

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
    mfaEnabled,
    regulator,
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

type MetricsRecorder = {
  recordSecurityEvent: (event: string) => void;
};

export async function authenticateRequest(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  roles: ReadonlyArray<Role>,
): Promise<Principal | null> {
  const metrics = (app as FastifyInstance & { metrics?: MetricsRecorder }).metrics;
  try {
    const principal = await verifyRequest(request, reply);
    requireRole(principal, roles);
    metrics?.recordSecurityEvent("auth.success");
    return principal;
  } catch (error) {
    if (error instanceof AuthError) {
      const code = error.statusCode === 403 ? "auth.forbidden" : "auth.unauthorized";
      metrics?.recordSecurityEvent(code);
      void reply.code(error.statusCode).send({ error: error.code ?? "unauthorized" });
      return null;
    }
    throw error;
  }
}
