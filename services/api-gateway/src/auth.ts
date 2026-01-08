import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionRole, SessionUser } from "./plugins/auth.js";
export { Role } from "./plugins/auth.js";
export type { SessionRole, SessionUser } from "./plugins/auth.js";

export type AuthConfig = {
  audience?: string;
  issuer?: string;
};

function hasValue(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

/**
 * Centralized JWT verify that supports optional issuer/audience.
 * fastify-jwt’s types don’t expose `audience` on the options in some versions,
 * so we cast to any as discussed.
 */
async function jwtVerifyWithCfg(req: FastifyRequest, cfg?: AuthConfig) {
  const audience = cfg?.audience;
  const issuer = cfg?.issuer;

  // If neither is configured, verify without options.
  if (!hasValue(audience) && !hasValue(issuer)) {
    await req.jwtVerify();
    return;
  }

  // If one is missing, only pass what exists (still cast to any).
  const opts: Record<string, string> = {};
  if (hasValue(audience)) opts.audience = audience;
  if (hasValue(issuer)) opts.issuer = issuer;

  await req.jwtVerify(opts as any);
}

function sendUnauthorized(reply: FastifyReply) {
  reply.code(401).send({ ok: false, error: "unauthorized" });
}

function sendForbidden(reply: FastifyReply) {
  reply.code(403).send({ ok: false, error: "forbidden" });
}

/**
 * Factory used by buildFastifyApp(opts.auth)
 */
export function createAuthGuard(cfg?: AuthConfig) {
  return async function authGuard(
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      await jwtVerifyWithCfg(req, cfg);
    } catch {
      sendUnauthorized(reply);
      return;
    }
  };
}

/**
 * Exported guard for modules that import `authGuard` directly.
 * Uses env defaults.
 */
export const authGuard = createAuthGuard({
  audience: process.env.AUTH_AUDIENCE,
  issuer: process.env.AUTH_ISSUER,
});

/**
 * Helper used by routes that want role checks.
 * Signature matches the “(req, reply, roles?)” pattern.
 */
export async function authenticateRequest(
  req: FastifyRequest,
  reply: FastifyReply,
  roles: SessionRole[] = []
): Promise<SessionUser | null> {
  try {
    await jwtVerifyWithCfg(req, {
      audience: process.env.AUTH_AUDIENCE,
      issuer: process.env.AUTH_ISSUER,
    });
  } catch {
    sendUnauthorized(reply);
    return null;
  }

  const user = req.user as SessionUser | undefined;
  if (!user) {
    sendUnauthorized(reply);
    return null;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    sendForbidden(reply);
    return null;
  }

  return user;
}
