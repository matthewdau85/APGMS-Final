import { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { prisma } from "../db.js";
import { signToken, buildSessionUser } from "../auth.js";
import { createRegulatorSession } from "../lib/regulator-session.js";
import { recordAuditLog } from "../lib/audit.js";

export async function registerRegulatorAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/regulator/login", async (request, reply) => {
    const body = request.body as { accessCode?: string; orgId?: string } | null;

    if (!body?.accessCode || body.accessCode.trim().length === 0) {
      reply.code(400).send({
        error: { code: "invalid_body", message: "accessCode is required" },
      });
      return;
    }

    if (body.accessCode.trim() !== config.regulator.accessCode) {
      reply.code(401).send({
        error: { code: "access_denied", message: "Invalid regulator access code" },
      });
      return;
    }

    const orgId = body.orgId ?? "dev-org";
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) {
      reply.code(404).send({
        error: { code: "org_not_found", message: "Organisation not found" },
      });
      return;
    }

    const { session, sessionToken } = await createRegulatorSession(
      orgId,
      config.regulator.sessionTtlMinutes,
    );

    const authUser = buildSessionUser({
      id: session.id,
      orgId,
      role: "regulator",
      mfaEnabled: false,
    });

    const token = await signToken(
      {
        id: authUser.sub,
        orgId: authUser.orgId,
        role: authUser.role,
        mfaEnabled: authUser.mfaEnabled,
      },
      {
        subject: session.id,
        audience: config.regulator.jwtAudience,
        expiresIn: `${config.regulator.sessionTtlMinutes}m`,
        extraClaims: {
          sessionId: session.id,
          regulator: true,
        },
      },
    );

    await recordAuditLog({
      orgId,
      actorId: `regulator:${session.id}`,
      action: "regulator.login",
      metadata: {},
    });

    reply.send({
      token,
      session: {
        id: session.id,
        issuedAt: session.issuedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        sessionToken,
      },
    });
  });
}
