import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library.js";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { parseWithSchema } from "../lib/validation.js";
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

      const data = parseWithSchema(createBankLineSchema, req.body);
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
        reply.header("Idempotent-Replay", "true");
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

      reply.header("Idempotent-Replay", "false");
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
