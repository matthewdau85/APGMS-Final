import { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { prisma } from "../db.js";
import { signToken, buildSessionUser } from "../auth.js";
import { createRegulatorSession } from "../lib/regulator-session.js";
import { recordAuditLog } from "../lib/audit.js";
import { parseWithSchema } from "../lib/validation.js";
import { RegulatorLoginSchema } from "../schemas/regulator.js";

export async function registerRegulatorAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/regulator/login", async (request, reply) => {
    const { accessCode, orgId } = parseWithSchema(
      RegulatorLoginSchema,
      request.body,
    );

    if (accessCode !== config.regulator.accessCode) {
      reply.code(401).send({
        error: { code: "access_denied", message: "Invalid regulator access code" },
      });
      return;
    }

    const targetOrgId = orgId ?? "dev-org";
    const org = await prisma.org.findUnique({
      where: { id: targetOrgId },
      select: { id: true },
    });
    if (!org) {
      reply.code(404).send({
        error: { code: "org_not_found", message: "Organisation not found" },
      });
      return;
    }

    const { session, sessionToken } = await createRegulatorSession(
      targetOrgId,
      config.regulator.sessionTtlMinutes,
    );

    const authUser = buildSessionUser({
      id: session.id,
      orgId: targetOrgId,
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
      orgId: targetOrgId,
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
