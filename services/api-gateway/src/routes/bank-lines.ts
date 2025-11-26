import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library.js";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { assertRoleForBankLines, requireOrgContext, redactBankLine } from "../utils/orgScope.js";

const createBankLineSchema = z.object({
  idempotencyKey: z.string().min(1),
  amount: z.number(),
  date: z.preprocess(
    (value) => (typeof value === "string" || value instanceof Date ? new Date(value as any) : value),
    z.date()
  ),
  payeeCiphertext: z.string().min(1),
  payeeKid: z.string().min(1),
  descCiphertext: z.string().min(1),
  descKid: z.string().min(1),
});

type BankLineRoutesDeps = {
  prisma: Pick<PrismaClient, "bankLine">;
};

export function createBankLinesPlugin(deps: BankLineRoutesDeps): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    app.post("/bank-lines", async (req, reply) => {
      const ctx = requireOrgContext(req, reply);
      if (!ctx) return;

      const parsed = createBankLineSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400).send({
          error: {
            code: "invalid_body",
            message: "Validation failed",
            details: parsed.error.flatten(),
          },
        });
        return;
      }

      const data = parsed.data;
      if (!assertRoleForBankLines(req, reply)) return;

      const existing = await deps.prisma.bankLine.findUnique({
        where: {
          orgId_idempotencyKey: {
            orgId: ctx.orgId,
            idempotencyKey: data.idempotencyKey,
          },
        },
      });

      if (existing) {
        reply.header("idempotent-replay", "true");
        reply.code(201).send(redactBankLine(existing));
        return;
      }

      const created = await deps.prisma.bankLine.create({
        data: {
          orgId: ctx.orgId,
          idempotencyKey: data.idempotencyKey,
          amount: new Decimal(data.amount),
          date: data.date,
          payeeCiphertext: data.payeeCiphertext,
          payeeKid: data.payeeKid,
          descCiphertext: data.descCiphertext,
          descKid: data.descKid,
        },
      });

      reply.header("idempotent-replay", "false");
      reply.code(201).send(redactBankLine(created));
    });

    app.get("/bank-lines", async (req, reply) => {
      const ctx = requireOrgContext(req, reply);
      if (!ctx) return;

      const rows = await deps.prisma.bankLine.findMany({
        where: { orgId: ctx.orgId },
        orderBy: { createdAt: "desc" },
      });

      reply.send({ lines: rows.map(redactBankLine) });
    });
  };
}

export const registerBankLinesRoutes: FastifyPluginAsync = createBankLinesPlugin({ prisma });

export default registerBankLinesRoutes;
