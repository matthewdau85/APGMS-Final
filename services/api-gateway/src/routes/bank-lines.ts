import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { shouldBlockTransfer, summarizeMitigations } from "../clients/ml-service.js";
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

    const amountMillions = Math.max(0, data.amount / 1_000_000);
    const [shortfallRisk, fraudRisk] = await Promise.all([
      app.mlClient.scoreShortfall({
        cash_on_hand: Math.max(0.2, 5 - amountMillions * 0.6),
        monthly_burn: Math.max(0.1, amountMillions * 0.8 + 0.4),
        obligations_due: Math.max(0.2, amountMillions * 0.9),
        forecast_revenue: Math.max(0.1, 1.8 - amountMillions * 0.3),
      }),
      app.mlClient.scoreFraud({
        transfer_amount: Math.max(0.05, amountMillions),
        daily_velocity: Math.max(0.05, amountMillions * 1.6 + 0.2),
        anomalous_counterparties: Math.max(0, Math.min(5, Math.round(amountMillions))),
        auth_risk_score: Math.min(1, 0.25 + amountMillions / 6),
        device_trust_score: Math.max(0.1, 0.9 - amountMillions / 8),
      }),
    ]);

    if (shouldBlockTransfer(shortfallRisk)) {
      reply.code(409).send({
        error: "shortfall_risk",
        risk: shortfallRisk,
        mitigations: summarizeMitigations(shortfallRisk),
      });
      return;
    }

    if (shouldBlockTransfer(fraudRisk)) {
      reply.code(409).send({
        error: "fraud_risk",
        risk: fraudRisk,
        mitigations: summarizeMitigations(fraudRisk),
      });
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

    reply.code(201).send({ ...redactBankLine(rec), risk: { shortfall: shortfallRisk, fraud: fraudRisk } });
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
