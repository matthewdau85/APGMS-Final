import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { generateDesignatedAccountReconciliationArtifact } from "../../../../domain/policy/designated-accounts.js";
import { prisma } from "../db.js";
import { recordAuditLog } from "../lib/audit.js";
import { assertOrgAccess, redactBankLine } from "../utils/orgScope.js";

// Accept the fields Prisma requires for a BankLine create
const createBankLineSchema = z.object({
  orgId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  amount: z.number(),
  // Accept ISO string or Date and coerce to Date
  date: z.preprocess(
    (v) => (typeof v === "string" || v instanceof Date ? new Date(v as any) : v),
    z.date()
  ),
  payeeCiphertext: z.string().min(1),
  payeeKid: z.string().min(1),
  descCiphertext: z.string().min(1),
  descKid: z.string().min(1)
});

export const registerBankLinesRoutes: FastifyPluginAsync = async (app) => {
  // Create (idempotent on (orgId, idempotencyKey))
  app.post("/bank-lines", async (req, reply) => {
    // Authorize org access for the caller's org
    const user = (req as any).user!;
    assertOrgAccess(req, reply, user.orgId);

    const parsed = createBankLineSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;

    if (data.amount <= 0) {
      reply.code(422).send({
        error: "deposit_only",
        message: "Designated accounts only accept deposit transactions"
      });
      return;
    }

    // Enforce caller may only write to their own org
    if (data.orgId !== user.orgId) {
      reply.code(403).send({ error: "forbidden" });
      return;
    }

    const rec = await prisma.bankLine.upsert({
      where: {
        orgId_idempotencyKey: {
          orgId: data.orgId,
          idempotencyKey: data.idempotencyKey
        }
      },
      update: {}, // idempotent
      create: {
        orgId: data.orgId,
        idempotencyKey: data.idempotencyKey,
        amount: data.amount,
        date: data.date,
        payeeCiphertext: data.payeeCiphertext,
        payeeKid: data.payeeKid,
        descCiphertext: data.descCiphertext,
        descKid: data.descKid
      }
    });

    const actorId = (user as any).sub ?? (user as any).id ?? "api";

    await prisma.scheduledRemittance.upsert({
      where: { bankLineId: rec.id },
      update: {
        amount: new Prisma.Decimal(data.amount),
        status: "QUEUED",
        scheduledFor: new Date()
      },
      create: {
        orgId: data.orgId,
        bankLineId: rec.id,
        amount: new Prisma.Decimal(data.amount),
        purpose: "bas_remittance",
        channel: "npp",
        status: "QUEUED"
      }
    });

    try {
      await generateDesignatedAccountReconciliationArtifact(
        {
          prisma,
          auditLogger: async (entry) => {
            await recordAuditLog({
              orgId: entry.orgId,
              actorId: entry.actorId,
              action: entry.action,
              metadata: entry.metadata
            });
          }
        },
        data.orgId,
        actorId
      );
    } catch (error) {
      req.log.error({ err: error }, "failed to generate designated account reconciliation");
    }

    reply.code(201).send(redactBankLine(rec));
  });

  // List for current org
  app.get("/bank-lines", async (req, reply) => {
    const user = (req as any).user!;
    assertOrgAccess(req, reply, user.orgId);

    const rows = await prisma.bankLine.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" }
    });

    reply.send({ lines: rows.map(redactBankLine) });
  });
};

export default registerBankLinesRoutes;
