// services/api-gateway/src/plugins/auth.ts
import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { FastifyPluginAsync } from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { loadConfig } from "../config.js";

const config = loadConfig(); // load once

export interface AuthedUser {
  sub: string;
  orgId: string;
  role: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthedUser;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // These should come from env
  // Example:
  // AUTH_ISSUER=https://auth.apgms.local
  // AUTH_AUDIENCE=apgms-api
  // AUTH_JWKS_URL=https://auth.apgms.local/.well-known/jwks.json
  const issuer = process.env.AUTH_ISSUER!;
  const audience = process.env.AUTH_AUDIENCE!;
  const jwksUrl = process.env.AUTH_JWKS_URL!;

  const jwks = createRemoteJWKSet(new URL(jwksUrl));

  fastify.decorateRequest("user", null);

  fastify.addHook("preHandler", async (request, reply) => {
    // Allow certain public routes through unauthenticated (eg /ready, /metrics if you want it public)
    // We'll lock down sensitive ones separately with orgScope() below.
    const allowedPublicPaths = ["/ready"];
    if (allowedPublicPaths.includes(request.routerPath ?? "")) {
      return;
    }

    const authHeader = request.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      reply.code(401).send({ error: "missing_token" });
      return;
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience
      });

      // We expect orgId and role to be in custom claims.
      // Adjust these claim names to match however you're minting tokens.
      const orgId = payload["orgId"];
      const role = payload["role"];

      if (!orgId || !role) {
        reply.code(403).send({ error: "forbidden_no_org_or_role" });
        return;
      }

      request.user = {
        sub: String(payload.sub ?? ""),
        orgId: String(orgId),
        role: String(role)
      };
    } catch (err) {
      reply.code(401).send({ error: "invalid_token" });
      return;
    }
  });
};

export default fp(authPlugin);
