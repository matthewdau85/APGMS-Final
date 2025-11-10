import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { mlServiceClient } from "../clients/mlServiceClient.js";
import { fetchFraudRisk, shouldBlockTransfer } from "../lib/risk.js";
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

    let fraudRisk = null;
    try {
      fraudRisk = await fetchFraudRisk(mlServiceClient, {
        orgId: data.orgId,
        amount: data.amount,
        settlementDate: data.date,
        payeeFingerprint: data.payeeCiphertext,
      });
    } catch (error) {
      req.log?.warn({ err: error }, "ml_fraud_risk_failed");
    }

    if (shouldBlockTransfer(fraudRisk)) {
      app.metrics?.recordSecurityEvent?.("bank_line.blocked_high_risk");
      reply.code(403).send({ error: "transfer_blocked", risk: fraudRisk });
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

    reply.code(201).send({ line: redactBankLine(rec), risk: fraudRisk });
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
