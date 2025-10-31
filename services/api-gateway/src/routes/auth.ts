// services/api-gateway/src/routes/auth.ts
import { FastifyInstance } from "fastify";
import {
  authGuard,
  verifyCredentials,
  signToken,
  buildClientUser,
  buildSessionUser,
} from "../auth.js";
import { prisma } from "../db.js";
import { recordAuditLog } from "../lib/audit.js";
import {
  createChallenge,
  verifyChallenge,
  clearVerification,
} from "../security/mfa.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
    };

    if (!body?.email || !body?.password) {
      reply.code(400).send({
        error: {
          code: "invalid_body",
          message: "email and password are required",
        },
      });
      return;
    }

    const user = await verifyCredentials(body.email, body.password);

    if (!user) {
      reply.code(401).send({
        error: {
          code: "bad_credentials",
          message: "Invalid email/password",
        },
      });
      return;
    }

    const authUser = buildSessionUser(user);
    const token = signToken({
      id: authUser.sub,
      orgId: authUser.orgId,
      role: authUser.role,
      mfaEnabled: authUser.mfaEnabled,
    });

    reply.send({
      token,
      user: buildClientUser(authUser),
    });
  });

  app.post(
    "/auth/mfa/initiate",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;
      if (!userId) {
        reply.code(401).send({
          error: { code: "unauthorized", message: "Missing user context" },
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, orgId: true },
      });

      if (!user) {
        reply.code(404).send({
          error: { code: "user_not_found", message: "User record missing" },
        });
        return;
      }

      const code = createChallenge(user.id);

      await recordAuditLog({
        orgId: user.orgId,
        actorId: user.id,
        action: "auth.mfa.initiate",
        metadata: {},
      });

      reply.send({
        delivery: "mock",
        code,
        expiresInSeconds: 300,
      });
    },
  );

  app.post(
    "/auth/mfa/verify",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;
      if (!userId) {
        reply.code(401).send({
          error: { code: "unauthorized", message: "Missing user context" },
        });
        return;
      }

      const body = request.body as { code?: string } | null;
      if (!body?.code || body.code.trim().length === 0) {
        reply.code(400).send({
          error: { code: "invalid_body", message: "code is required" },
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, orgId: true, mfaEnabled: true, role: true },
      });

      if (!user) {
        reply.code(404).send({
          error: { code: "user_not_found", message: "User record missing" },
        });
        return;
      }

      const ok = verifyChallenge(user.id, body.code.trim());
      if (!ok) {
        reply.code(401).send({
          error: { code: "mfa_invalid", message: "Incorrect or expired code" },
        });
        return;
      }

      if (!user.mfaEnabled) {
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaEnabled: true },
        });
      }

      await recordAuditLog({
        orgId: user.orgId,
        actorId: user.id,
        action: "auth.mfa.verify",
        metadata: { enabled: true },
      });

      const authUser = buildSessionUser({
        id: user.id,
        orgId: user.orgId,
        role: user.role ?? "admin",
        mfaEnabled: true,
      });

      const token = signToken({
        id: authUser.sub,
        orgId: authUser.orgId,
        role: authUser.role,
        mfaEnabled: true,
      });

      reply.send({
        token,
        user: buildClientUser(authUser),
        session: {
          expiresInSeconds: 600,
          verifiedAt: new Date().toISOString(),
        },
      });
    },
  );

  app.post(
    "/auth/mfa/reset",
    { preHandler: authGuard },
    async (request, reply) => {
      const claims: any = (request as any).user;
      const userId = claims?.sub as string | undefined;
      if (!userId) {
        reply.code(401).send({
          error: { code: "unauthorized", message: "Missing user context" },
        });
        return;
      }

      clearVerification(userId);

      reply.send({ status: "cleared" });
    },
  );
}
