import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload, JWTVerifyResult } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";

export type Role = "admin" | "manager" | "analyst" | "viewer";

declare module "fastify" {
  interface FastifyRequest {
    auth?: { sub: string; orgId: string; roles: Role[] };
  }
}

interface Opts {
  jwksUrl: string;
  issuer: string;
  audience: string;
  verify?: (token: string) => Promise<Pick<JWTVerifyResult, "payload">>;
}

export default fp<Opts>(async (app, opts) => {
  const JWKS = opts.verify ? undefined : createRemoteJWKSet(new URL(opts.jwksUrl));

  const verifyToken = opts.verify
    ? opts.verify
    : (token: string) => jwtVerify(token, JWKS!, { issuer: opts.issuer, audience: opts.audience });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const hdr = req.headers.authorization ?? "";
      const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : undefined;
      if (!token) {
        await reply.code(401).send({ error: "Unauthorized" });
        return reply;
      }

      const { payload } = await verifyToken(token);
      const payloadData = payload as JWTPayload & {
        orgId?: string;
        roles?: Role[];
      };

      const orgId = payloadData.orgId ?? "";
      if (!orgId) {
        await reply.code(401).send({ error: "Unauthorized" });
        return reply;
      }

      const roles = Array.isArray(payloadData.roles) ? payloadData.roles : [];

      req.auth = {
        sub: String(payloadData.sub ?? ""),
        orgId: String(orgId),
        roles: roles.map((role) => role),
      };
    } catch {
      await reply.code(401).send({ error: "Unauthorized" });
      return reply;
    }
  });

  app.decorate("requireRole", (roles: Role[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const hasRole =
        req.auth !== undefined && req.auth.roles.some((role) => roles.includes(role));

      if (!hasRole) {
        await reply.code(403).send({ error: "Forbidden" });
        return reply;
      }
    };
  });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: Role[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
