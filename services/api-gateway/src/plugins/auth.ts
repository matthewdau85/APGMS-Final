import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { loadConfig } from "../config.js";

/** Roles you use in the gateway */
export type Role = "admin" | "user" | "regulator";

/** Shape we attach to request.user */
export interface AuthenticatedUser {
  sub: string;
  orgId: string;
  role: Role;
  mfaEnabled: boolean;
}

/**
 * Pre-handler that verifies a Bearer token and attaches request.user.
 * Public endpoints (health/ready) bypass auth.
 */
export async function authenticateRequest(request: FastifyRequest, reply: FastifyReply) {
  const cfg = loadConfig();

  const url = request.url ?? "";
  if (url === "/health" || url === "/ready" || url === "/live") {
    return; // public
  }

  const header = request.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }

  const token = header.slice("Bearer ".length);

  // RS256 path if provided, otherwise use HS256 dev secret
  const publicKey = process.env.JWT_PUBLIC_KEY;
  const secretOrPublic = (publicKey && publicKey.trim().length > 0)
    ? publicKey
    : cfg.auth.devSecret;

  // Keep audience simple as a string
  const aud = Array.isArray(cfg.auth.audience) ? cfg.auth.audience[0] : cfg.auth.audience;

  const verifyOpts: jwt.VerifyOptions = {
    audience: aud,
    issuer: cfg.auth.issuer,
    algorithms: ((publicKey && publicKey.trim().length > 0) ? ["RS256"] : ["HS256"]) as jwt.Algorithm[]
  };

  let payload: any;
  try {
    payload = jwt.verify(token, secretOrPublic as jwt.Secret, verifyOpts);
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return;
  }

  const user: AuthenticatedUser = {
    sub: String(payload.sub ?? ""),
    orgId: String(payload.orgId ?? payload.org_id ?? ""),
    role: (payload.role ?? "user") as Role,
    mfaEnabled: Boolean(payload.mfaEnabled ?? payload.mfa_enabled ?? false),
  };

  (request as any).user = user;
}

export default authenticateRequest;
