// services/api-gateway/src/auth.ts
import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "./config";

export interface JwtClaims {
  sub: string;     // user id
  orgId: string;
  role: string;    // "admin"
  aud: string;
  iss: string;
  iat?: number;
  exp?: number;
}

// helper to issue a JWT after successful login
export function issueJwt(user: {
  id: string;
  orgId: string;
  role?: string;
}) {
  const claims: JwtClaims = {
    sub: user.id,
    orgId: user.orgId,
    role: user.role ?? "admin",
    aud: config.AUTH_AUDIENCE,
    iss: config.AUTH_ISSUER,
  };

  // sign HS256 for dev
  const token = jwt.sign(claims, config.AUTH_DEV_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
    audience: config.AUTH_AUDIENCE,
    issuer: config.AUTH_ISSUER,
  });

  return token;
}

// Fastify preHandler to protect routes
export async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    reply.code(401).send({
      error: { code: "unauthorized", message: "Missing Authorization header" },
    });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, config.AUTH_DEV_SECRET, {
      algorithms: ["HS256"],
      audience: config.AUTH_AUDIENCE,
      issuer: config.AUTH_ISSUER,
    }) as JwtClaims;

    // attach user info to request for downstream handlers
    (request as any).user = decoded;
  } catch (err) {
    reply.code(401).send({
      error: { code: "unauthorized", message: "Invalid or expired token" },
    });
    return;
  }
}

// utility to compare a plaintext password vs bcrypt hash
export async function verifyPassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
