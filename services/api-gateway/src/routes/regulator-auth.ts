import { FastifyInstance } from "fastify";
import { z } from "zod";

import { notFound, unauthorized } from "@apgms/shared";

import { config } from "../config.js";
import { prisma } from "../db.js";
import { signToken, buildSessionUser } from "../auth.js";
import { createRegulatorSession } from "../lib/regulator-session.js";
import { recordAuditLog } from "../lib/audit.js";
import { parseWithSchema } from "../lib/validation.js";

const RegulatorLoginBodySchema = z
  .object({
    accessCode: z
      .string({
        required_error: "accessCode is required",
        invalid_type_error: "accessCode must be a string",
      })
      .trim()
      .min(1, "accessCode is required"),
  })
  .strict();

export async function registerRegulatorAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/regulator/login", async (request, reply) => {
    const { accessCode } = parseWithSchema(
      RegulatorLoginBodySchema,
      request.body,
    );

    const orgId = config.regulator.accessCodeOrgMap[accessCode];
    if (!orgId) {
      throw unauthorized("access_denied", "Invalid regulator access code");
    }

    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) {
      throw notFound("org_not_found", "Organisation not found");
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
      orgId,
      session: {
        id: session.id,
        issuedAt: session.issuedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        sessionToken,
      },
    });
  });
}
