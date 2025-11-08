// services/api-gateway/src/auth.ts
import { FastifyReply, FastifyRequest } from "fastify";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

import { verifyPassword as verifyArgonPassword } from "@apgms/shared";

import { prisma } from "./db.js";

const AUD = process.env.AUTH_AUDIENCE!;
const ISS = process.env.AUTH_ISSUER!;
const SECRET = process.env.AUTH_DEV_SECRET!; // HS256 key
const REGULATOR_AUD =
  process.env.REGULATOR_JWT_AUDIENCE?.trim().length
    ? process.env.REGULATOR_JWT_AUDIENCE!.trim()
    : "urn:apgms:regulator";
const CLOCK_TOLERANCE_SECONDS = 60;

export type TokenClaims = JwtPayload & Record<string, unknown>;

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

export function signToken(
  user: {
    id: string;
    orgId: string;
    role?: string;
    mfaEnabled?: boolean;
  },
  options: SignTokenOptions = {},
) {
  const payload: TokenClaims = {
    sub: options.subject ?? user.id,
    orgId: user.orgId,
    role: user.role ?? "admin",
    mfaEnabled: user.mfaEnabled ?? false,
    ...(options.extraClaims ?? {}),
  };


  const signOptions: SignOptions = {
    algorithm: "HS256",
    expiresIn: (options.expiresIn ?? "1h") as SignOptions["expiresIn"],
    audience: options.audience ?? AUD,
    issuer: ISS,
  };

  return jwt.sign(payload, SECRET, signOptions);
}

type GuardValidateFn = (
  payload: TokenClaims,
  request: FastifyRequest,
) => Promise<void> | void;

interface GuardOptions {
  validate?: GuardValidateFn;
}

export function createAuthGuard(
  expectedAudience: string,
  options: GuardOptions = {},
) {
  function validateClaims(payload: TokenClaims, request: FastifyRequest): AuthenticatedUser {
    const audience = payload.aud;
    if (Array.isArray(audience)) {
      if (!audience.includes(expectedAudience)) {
        throw new Error("unexpected_audience");
      }
    } else if (audience && audience !== expectedAudience) {
      throw new Error("unexpected_audience");
    }

    const sub =
      typeof payload.sub === "string"
        ? payload.sub
        : typeof (payload as any).id === "string"
          ? (payload as any).id
          : null;
    if (!sub) {
      throw new Error("missing_subject");
    }

    const orgId = typeof payload.orgId === "string" ? payload.orgId : null;
    if (!orgId) {
      throw new Error("missing_org_scope");
    }

    const role = typeof payload.role === "string" ? payload.role : null;
    if (!role) {
      throw new Error("missing_role_scope");
    }

    const mfaEnabled = payload.mfaEnabled === true;
    const regulator = payload.regulator === true;
    const sessionId =
      typeof payload.sessionId === "string" ? payload.sessionId : undefined;

    const authContext: AuthenticatedUser = {
      sub,
      orgId,
      role,
      mfaEnabled,
      regulator,
      sessionId,
    };

    return authContext;
  }

  return async function authGuardInstance(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      reply.code(401).send({
        error: { code: "unauthorized", message: "Missing bearer token" },
      });
      return;
    }

    const token = header.substring("Bearer ".length).trim();

    try {
      const decoded = jwt.verify(token, SECRET, {
        algorithms: ["HS256"],
        audience: expectedAudience,
        issuer: ISS,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      }) as TokenClaims;

      if (options.validate) {
        await options.validate(decoded, request);
      }

      const context = validateClaims(decoded, request);
      (request as any).user = context;
    } catch {
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

  const ok = await verifyArgonPassword(user.password, pw);
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

