// services/api-gateway/src/auth.ts
import { FastifyReply, FastifyRequest } from "fastify";
import jwt, { JwtPayload, type Secret } from "jsonwebtoken";
import { SignJWT, importJWK, type JWK } from "jose";

import { verifyPassword } from "@apgms/shared";
import { verifyRequest, AuthError as JwtAuthError, type Principal } from "./lib/auth.js";

import { prisma } from "./db.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const AUD = requireEnv("AUTH_AUDIENCE");
const ISS = requireEnv("AUTH_ISSUER");
const SECRET: Secret | undefined = process.env.AUTH_DEV_SECRET;
const regulatorAudience = process.env.REGULATOR_JWT_AUDIENCE?.trim();
const REGULATOR_AUD =
  regulatorAudience && regulatorAudience.length
    ? regulatorAudience
    : "urn:apgms:regulator";

type SigningKey = {
  kid: string;
  key: Parameters<typeof SignJWT.prototype.sign>[0];
  alg: string;
};

let signingKeyCache: SigningKey | null = null;

async function loadSigningKey(): Promise<SigningKey | null> {
  if (signingKeyCache) {
    return signingKeyCache;
  }
  const jwksEnv = process.env.AUTH_JWKS;
  if (!jwksEnv) {
    return null;
  }
  let parsed: { keys?: JWK[] };
  try {
    parsed = JSON.parse(jwksEnv) as { keys?: JWK[] };
  } catch {
    return null;
  }
  const jwk = (parsed.keys ?? []).find(
    (entry) =>
      entry.kid && entry.alg && typeof entry.d === "string" && entry.d.length > 0,
  );
  if (!jwk) {
    return null;
  }
  const key = await importJWK(jwk, jwk.alg);
  const kid = jwk.kid;
  const alg = jwk.alg;
  if (!kid || !alg) {
    throw new Error("JWT header missing kid or alg");
  }
  signingKeyCache = { kid, key, alg };
  return signingKeyCache;
}

export type TokenClaims = JwtPayload & {
  orgId?: string;
  org?: string;
  roles?: string[];
  role?: string;
  regulator?: boolean;
  sessionId?: string;
};

export interface SignTokenOptions {
  audience?: string;
  expiresIn?: string;
  subject?: string;
  extraClaims?: Record<string, unknown>;
}

export interface AuthenticatedUser {
  sub: string;
  orgId: string;
  role: string;
  mfaEnabled: boolean;
  mfaVerified?: boolean;
  regulator?: boolean;
  sessionId?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

function toSessionUser(user: {
  id: string;
  orgId: string;
  role?: string | null;
  mfaEnabled?: boolean | null;
}): AuthenticatedUser {
  return {
    sub: user.id,
    orgId: user.orgId,
    role: user.role ?? "admin",
    mfaEnabled: Boolean(user.mfaEnabled),
  };
}

export async function signToken(
  user: {
    id: string;
    orgId: string;
    role?: string;
    mfaEnabled?: boolean;
  },
  options: SignTokenOptions = {},
): Promise<string> {
  const payload: TokenClaims = {
    sub: options.subject ?? user.id,
    orgId: user.orgId,
    role: user.role ?? "admin",
    mfaEnabled: user.mfaEnabled ?? false,
    ...(options.extraClaims ?? {}),
  };

  const audience = options.audience ?? AUD;
  const issuer = ISS;
  const expiresIn = options.expiresIn ?? "1h";

  const signingKey = await loadSigningKey();
  if (signingKey) {
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: signingKey.alg, kid: signingKey.kid })
      .setAudience(audience)
      .setIssuer(issuer)
      .setSubject(String(payload.sub))
      .setExpirationTime(expiresIn)
      .setIssuedAt()
      .sign(signingKey.key);
    return token;
  }

  const secret = SECRET;
  if (!secret) {
    throw new Error("AUTH_DEV_SECRET is required when no JWKS signing key is configured");
  }
  const signingSecret: Secret = secret;
  const signOptions: jwt.SignOptions = {
    algorithm: "HS256",
    audience,
    issuer,
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  };

  return jwt.sign(payload, signingSecret, signOptions);
}

type GuardValidateFn = (
  principal: Principal,
  request: FastifyRequest,
) => Promise<void> | void;

interface GuardOptions {
  validate?: GuardValidateFn;
}

export function createAuthGuard(
  expectedAudience: string,
  options: GuardOptions = {},
) {
  return async function authGuardInstance(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const principal = await verifyRequest(request, reply, {
        audience: expectedAudience,
      });

      if (options.validate) {
        await options.validate(principal, request);
      }

      const context: AuthenticatedUser = {
        sub: principal.id,
        orgId: principal.orgId,
        role: principal.roles[0] ?? "admin",
        mfaEnabled: principal.mfaEnabled,
        mfaVerified: (principal as any).mfaVerified ?? principal.mfaEnabled,
        regulator: principal.regulator,
        sessionId: principal.sessionId,
      };

      (request as any).user = context;
    } catch (error) {
      if (error instanceof JwtAuthError) {
        reply.code(error.statusCode).send({
          error: { code: error.code ?? "unauthorized", message: error.message },
        });
        return;
      }
      reply.code(401).send({
        error: { code: "unauthorized", message: "Invalid token" },
      });
      return;
    }
  };
}

export const authGuard = createAuthGuard(AUD);
export const REGULATOR_AUDIENCE = REGULATOR_AUD;

export async function verifyCredentials(
  email: string,
  pw: string,
) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      orgId: true,
      role: true,
      mfaEnabled: true,
      password: true,
    },
  });
  if (!user) return null;

  const ok = await verifyPassword(user.password, pw);
  if (!ok) return null;

  return {
    id: user.id,
    orgId: user.orgId,
    role: user.role ?? "admin",
    mfaEnabled: user.mfaEnabled ?? false,
  };
}

export function buildSessionUser(user: {
  id: string;
  orgId: string;
  role?: string | null;
  mfaEnabled?: boolean | null;
}): AuthenticatedUser {
  return toSessionUser(user);
}

export function buildClientUser(user: AuthenticatedUser) {
  return {
    id: user.sub,
    orgId: user.orgId,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
  };
}

