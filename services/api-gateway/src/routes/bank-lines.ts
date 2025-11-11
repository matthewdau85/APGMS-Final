import { Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { assertOrgAccess, assertRoleForBankLines, redactBankLine } from "../utils/orgScope.js";

const createBankLineSchema = z.object({
  orgId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  amount: z.number(),
  date: z.preprocess(
    (value) => (typeof value === "string" || value instanceof Date ? new Date(value as any) : value),
    z.date()
  ),
  payeeCiphertext: z.string().min(1),
  payeeKid: z.string().min(1),
  descCiphertext: z.string().min(1),
  descKid: z.string().min(1)
});

type BankLineRoutesDeps = {
  prisma: Pick<PrismaClient, "bankLine">;
};

function ensureUser(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user as { orgId: string } | undefined;
  if (!user) {
    reply.code(401).send({
      error: { code: "unauthorized", message: "Authentication required" }
    });
    return null;
  }
  return user;
}

export function createBankLinesPlugin(deps: BankLineRoutesDeps): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    app.post("/bank-lines", async (req, reply) => {
      const user = ensureUser(req, reply);
      if (!user) return;

      const parsed = createBankLineSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({
          error: {
            code: "invalid_body",
            message: "Validation failed",
            details: parsed.error.flatten()
          }
        });
        return;
      }

      const data = parsed.data;

      if (!assertOrgAccess(req, reply, data.orgId)) return;
      if (!assertRoleForBankLines(req, reply)) return;

      if (data.orgId !== user.orgId) {
        reply.code(403).send({
          error: {
            code: "forbidden_wrong_org",
            message: "Cannot create bank lines for another organisation"
          }
        });
        return;
      }

      const existing = await deps.prisma.bankLine.findUnique({
        where: {
          orgId_idempotencyKey: {
            orgId: data.orgId,
            idempotencyKey: data.idempotencyKey
          }
        }
      });

      if (existing) {
        reply.header("idempotent-replay", "true");
        reply.code(201).send(redactBankLine(existing));
        return;
      }

      const created = await deps.prisma.bankLine.create({
        data: {
          orgId: data.orgId,
          idempotencyKey: data.idempotencyKey,
          amount: new Prisma.Decimal(data.amount),
          date: data.date,
          payeeCiphertext: data.payeeCiphertext,
          payeeKid: data.payeeKid,
          descCiphertext: data.descCiphertext,
          descKid: data.descKid
        }
      });

      reply.header("idempotent-replay", "false");
      reply.code(201).send(redactBankLine(created));
    });

    app.get("/bank-lines", async (req, reply) => {
      const user = ensureUser(req, reply);
      if (!user) return;

      if (!assertOrgAccess(req, reply, user.orgId)) return;

      const rows = await deps.prisma.bankLine.findMany({
        where: { orgId: user.orgId },
        orderBy: { createdAt: "desc" }
      });

      reply.send({ lines: rows.map(redactBankLine) });
    });
  };
}

export const registerBankLinesRoutes: FastifyPluginAsync = createBankLinesPlugin({ prisma });

export default registerBankLinesRoutes;
