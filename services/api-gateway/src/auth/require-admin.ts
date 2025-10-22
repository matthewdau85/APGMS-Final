import type { FastifyReply, FastifyRequest } from "fastify";

import { maskError } from "@apgms/shared";

import { AdminTokenError, verifyAdminToken, type AdminTokenClaims } from "./jwt";

export interface AdminPrincipal {
  id: string;
  orgId: string;
  email?: string;
  token: string;
  claims: AdminTokenClaims;
}

function extractBearerToken(req: FastifyRequest): string | null {
  const header = req.headers["authorization"] ?? req.headers["Authorization" as keyof typeof req.headers];
  if (!header) {
    return null;
  }

  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1] : null;
}

export async function requireAdmin(
  req: FastifyRequest,
  rep: FastifyReply
): Promise<AdminPrincipal | null> {
  const token = extractBearerToken(req);
  if (!token) {
    req.log.warn("admin token missing");
    void rep.code(401).send({ error: "unauthorized" });
    return null;
  }

  try {
    const claims = await verifyAdminToken(token);
    if (claims.role !== "admin") {
      req.log.warn({ role: claims.role }, "principal not authorised for admin access");
      void rep.code(403).send({ error: "forbidden" });
      return null;
    }

    return {
      id: claims.sub,
      orgId: claims.orgId,
      email: claims.email,
      token,
      claims,
    };
  } catch (err) {
    const isKnown = err instanceof AdminTokenError;
    req.log.warn({ err: maskError(err) }, "admin token verification failed");
    void rep.code(isKnown ? 401 : 500).send({ error: "unauthorized" });
    return null;
  }
}
