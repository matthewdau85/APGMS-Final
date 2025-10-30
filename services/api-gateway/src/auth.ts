// services/api-gateway/src/auth.ts
import { FastifyReply, FastifyRequest } from "fastify";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";

import { prisma } from "./db.js";

const AUD = process.env.AUTH_AUDIENCE!;
const ISS = process.env.AUTH_ISSUER!;
const SECRET = process.env.AUTH_DEV_SECRET!; // HS256 key
const REGULATOR_AUD =
  process.env.REGULATOR_JWT_AUDIENCE?.trim().length
    ? process.env.REGULATOR_JWT_AUDIENCE!.trim()
    : "urn:apgms:regulator";

export type TokenClaims = JwtPayload & Record<string, unknown>;

export interface SignTokenOptions {
  audience?: string;
  expiresIn?: string;
  subject?: string;
  extraClaims?: Record<string, unknown>;
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
      }) as TokenClaims;

      if (options.validate) {
        await options.validate(decoded, request);
      }

      (request as any).user = decoded;
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
  });
  if (!user) return null;

  const ok = await bcrypt.compare(pw, user.password);
  if (!ok) return null;

  return user;
}


