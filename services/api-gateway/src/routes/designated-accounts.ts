import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authGuard } from "../auth.js";
import { prisma } from "../db.js";
import { parseWithSchema } from "../lib/validation.js";
import { recordAuditLog } from "../lib/audit.js";
import {
  forbidden,
  unauthorized,
} from "@apgms/shared";
import {
  applyDesignatedAccountTransfer,
  type ApplyDesignatedTransferResult,
  type DesignatedAccountAuditEntry,
} from "../../../../domain/policy/designated-accounts.js";
import {
  requireRecentVerification,
  verifyChallenge,
} from "../security/mfa.js";

type DesignatedAccountRouteDependencies = {
  prisma: typeof prisma;
  applyTransfer: typeof applyDesignatedAccountTransfer;
  recordAuditLog: typeof recordAuditLog;
  requireRecentVerification: typeof requireRecentVerification;
  verifyChallenge: typeof verifyChallenge;
};

const defaultDependencies: DesignatedAccountRouteDependencies = {
  prisma,
  applyTransfer: applyDesignatedAccountTransfer,
  recordAuditLog,
  requireRecentVerification,
  verifyChallenge,
};

const CreditBodySchema = z
  .object({
    amount: z
      .union([z.number(), z.string()])
      .transform((value) =>
        typeof value === "number" ? value : Number.parseFloat(value),
      )
      .refine((value) => Number.isFinite(value) && value > 0, {
        message: "amount must be a positive number",
      }),
    source: z.string().trim().min(1).max(120),
    mfaCode: z.string().trim().min(6).max(12).optional(),
  })
  .strict();

const CreditParamsSchema = z
  .object({
    accountId: z.string().trim().min(1),
  })
  .strict();

export async function registerDesignatedAccountRoutes(
  app: FastifyInstance,
  overrides: Partial<DesignatedAccountRouteDependencies> = {},
): Promise<void> {
  const deps: DesignatedAccountRouteDependencies = {
    ...defaultDependencies,
    ...overrides,
  };

  const ensureStepUp = async (
    userId: string,
    mfaCode: string | undefined,
  ): Promise<void> => {
    if (deps.requireRecentVerification(userId)) {
      return;
    }
    if (!mfaCode) {
      throw forbidden(
        "mfa_required",
        "Multi-factor verification required to perform this action",
      );
    }
    const result = await deps.verifyChallenge(userId, mfaCode);
    if (!result.success) {
      throw unauthorized("mfa_invalid", "MFA verification failed");
    }
  };

  app.post(
    "/org/designated-accounts/:accountId/credit",
    { preHandler: authGuard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        throw unauthorized("unauthorized", "Missing user context");
      }

      const params = parseWithSchema(CreditParamsSchema, request.params);
      const body = parseWithSchema(CreditBodySchema, request.body);

      await ensureStepUp(user.sub, body.mfaCode);

      const result: ApplyDesignatedTransferResult = await deps.applyTransfer(
        {
          prisma: deps.prisma,
          auditLogger: async (entry: DesignatedAccountAuditEntry) => {
            await deps.recordAuditLog({
              orgId: entry.orgId,
              actorId: entry.actorId,
              action: entry.action,
              metadata: entry.metadata,
            });
          },
        },
        {
          orgId: user.orgId,
          accountId: params.accountId,
          amount: body.amount,
          source: body.source,
          actorId: user.sub,
        },
      );

      reply.code(201).send({
        transfer: {
          id: result.transferId,
          accountId: result.accountId,
          newBalance: result.newBalance,
          source: result.source,
        },
      });
    },
  );
}

export default registerDesignatedAccountRoutes;
