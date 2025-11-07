import { FastifyInstance } from "fastify";

import { RegulatorLoginBodySchema } from "@apgms/shared";

import { config } from "../config.js";
import { prisma } from "../db.js";
import { signToken, buildSessionUser } from "../auth.js";
import { createRegulatorSession } from "../lib/regulator-session.js";
import { recordAuditLog } from "../lib/audit.js";
import { parseWithSchema } from "../lib/validation.js";

export async function registerRegulatorAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/regulator/login", async (request, reply) => {
    const { accessCode, orgId } = parseWithSchema(
      RegulatorLoginBodySchema,
      request.body,
    );

    if (accessCode !== config.regulator.accessCode) {
      app.metrics.recordSecurityEvent("regulator.login.invalid_code");
      reply.code(401).send({
        error: { code: "access_denied", message: "Invalid regulator access code" },
      });
      return;
    }
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) {
      app.metrics.recordSecurityEvent("regulator.login.unknown_org");
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

    const token = signToken(
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
