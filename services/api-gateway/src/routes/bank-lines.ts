import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { publishComplianceEvent } from "../lib/compliance-events.js";
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

const LARGE_MANUAL_AMOUNT = 100_000;

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

    await publishComplianceEvent(app, {
      kind: "OVERRIDE",
      orgId: data.orgId,
      category: "bank_line.manual_entry",
      severity: "MEDIUM",
      description: "Manual bank line recorded via API gateway",
      metadata: {
        bankLineId: rec.id,
        amount: data.amount,
        occurredOn: data.date.toISOString(),
        idempotencyKey: data.idempotencyKey,
      },
      actor: { type: "user", id: user.sub, role: user.role },
      occurredAt: data.date,
      request: req,
      source: "api-gateway.bank-lines",
    });

    if (Math.abs(data.amount) >= LARGE_MANUAL_AMOUNT) {
      await publishComplianceEvent(app, {
        kind: "DISCREPANCY",
        orgId: data.orgId,
        category: "bank_line.large_manual_entry",
        severity: "HIGH",
        description: "High-value manual bank line requires reconciliation review",
        metadata: {
          bankLineId: rec.id,
          amount: data.amount,
          threshold: LARGE_MANUAL_AMOUNT,
        },
        actor: { type: "user", id: user.sub, role: user.role },
        occurredAt: data.date,
        request: req,
        source: "api-gateway.bank-lines",
      });
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
