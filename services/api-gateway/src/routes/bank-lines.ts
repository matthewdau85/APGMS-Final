import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { StructuredEvent } from "../plugins/structured-events.js";
import { prisma } from "../db.js";
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

    reply.code(201).send(redactBankLine(rec));

    if (typeof req.publishStructuredEvent === "function") {
      const amount = Number((rec as any).amount ?? data.amount ?? 0);
      const amountCents = Math.round(amount * 100);
      const highValue = Math.abs(amount) >= 5000;

      const event: StructuredEvent = {
        type: "discrepancy.detected",
        entityType: "discrepancy",
        entityId: rec.id,
        orgId: rec.orgId,
        status: "open",
        severity: highValue ? "high" : "low",
        summary: `Bank line ${rec.id} ingested`,
        tags: ["bank_line", "compliance"],
        payload: {
          bankLineId: rec.id,
          orgId: rec.orgId,
          amount,
          amountCents,
          currency: "AUD",
          trigger: "bank_line_ingest",
          riskScore: Math.min(1, Math.abs(amount) / 10000),
          category: highValue ? "high_value_payment" : "standard_payment",
          label: highValue ? "requires_review" : "auto_clear",
          sensitiveAttribute: highValue ? "high_volume" : "standard_volume",
          createdAt: rec.createdAt,
        },
      };

      try {
        await req.publishStructuredEvent(event);
      } catch (error) {
        req.log.error({ err: error, bankLineId: rec.id }, "bank_line_event_publish_failed");
      }
    }
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
