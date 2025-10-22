import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { maskError } from "@apgms/shared";

type JwtClaims = {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  orgId?: string;
  email?: string;
  [key: string]: unknown;
};

const ClaimsSchema = z.object({
  sub: z.string().min(1),
  orgId: z.string().min(1),
  email: z.string().email().optional(),
});

export interface AuthContext {
  userId: string;
  orgId: string;
  email: string | null;
  claims: JwtClaims;
}

type PrismaLike = Pick<PrismaClient, "user">;

declare module "fastify" {
  interface FastifyRequest {
    principal: AuthContext | null;
  }
}

export interface AuthVerifierOptions {
  issuer: string;
  audience: string;
  secret: string;
  prisma: PrismaLike;
}

export function createAuthVerifier(options: AuthVerifierOptions) {
  const { issuer, audience, secret, prisma } = options;
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is not configured");
  }
  if (!issuer) {
    throw new Error("AUTH_JWT_ISSUER is not configured");
  }
  if (!audience) {
    throw new Error("AUTH_JWT_AUDIENCE is not configured");
  }

  return async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    req.principal = null;

    const header = req.headers.authorization;
    if (!header || (Array.isArray(header) ? header.length === 0 : false)) {
      await reply.code(401).send({ error: "unauthenticated" });
      return reply;
    }

    const value = Array.isArray(header) ? header[0] : header;
    const token = value.startsWith("Bearer ") ? value.slice(7).trim() : "";
    if (!token) {
      await reply.code(401).send({ error: "unauthenticated" });
      return reply;
    }

    let payload: JwtClaims;
    try {
      payload = verifyJwt(token, secret, issuer, audience);
    } catch (err) {
      req.log.warn({ err: maskError(err) }, "failed to verify jwt");
      await reply.code(401).send({ error: "unauthenticated" });
      return reply;
    }

    const parsed = ClaimsSchema.safeParse(payload);
    if (!parsed.success) {
      req.log.warn({ err: parsed.error.flatten() }, "jwt missing required claims");
      await reply.code(403).send({ error: "forbidden" });
      return reply;
    }

    const { sub, orgId, email } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, orgId: true },
    });

    if (!user || user.orgId !== orgId) {
      await reply.code(403).send({ error: "forbidden" });
      return reply;
    }

    req.principal = {
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
      claims: payload,
    };
  };
}

function verifyJwt(token: string, secret: string, issuer: string, audience: string): JwtClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_token");
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(Buffer.from(headerSegment, "base64url").toString("utf8"));
  } catch (err) {
    throw new Error("invalid_token_header");
  }
  if (header.alg !== "HS256") {
    throw new Error("unsupported_algorithm");
  }

  const payloadBuffer = Buffer.from(payloadSegment, "base64url");
  let claims: JwtClaims;
  try {
    claims = JSON.parse(payloadBuffer.toString("utf8"));
  } catch (err) {
    throw new Error("invalid_token_payload");
  }

  const expectedSignature = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(`${headerSegment}.${payloadSegment}`)
    .digest();
  const providedSignature = Buffer.from(signatureSegment, "base64url");
  if (expectedSignature.length !== providedSignature.length) {
    throw new Error("invalid_signature");
  }
  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error("invalid_signature");
  }

  if (claims.iss !== issuer) {
    throw new Error("invalid_issuer");
  }

  const audClaim = claims.aud;
  const matchesAudience = Array.isArray(audClaim)
    ? audClaim.includes(audience)
    : audClaim === audience;
  if (!matchesAudience) {
    throw new Error("invalid_audience");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) {
    throw new Error("token_expired");
  }
  if (claims.nbf !== undefined && typeof claims.nbf === "number" && claims.nbf > now) {
    throw new Error("token_not_ready");
  }

  return claims;
}
