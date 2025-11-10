import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { assertOrgAccess, redactBankLine } from "../utils/orgScope.js";
import { publishOperationalEvent, operationalSubjects } from "../lib/events.js";

// Accept the fields Prisma requires for a BankLine create

function toDecimalString(value: unknown): string {
  if (value && typeof value === "object" && "toString" in value && typeof (value as { toString: () => string }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return String(value ?? "0");
}
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

const DISCREPANCY_THRESHOLD = 100_000;

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

    await publishOperationalEvent(app, {
      subject: operationalSubjects.ledger.bankLineRecorded,
      eventType: "ledger.bank_line.recorded",
      orgId: data.orgId,
      key: rec.id,
      dedupeId: data.idempotencyKey ?? undefined,
      payload: {
        bankLineId: rec.id,
        amount: toDecimalString((rec as any).amount),
        occurredAt: rec.date.toISOString(),
        payeeKey: rec.payeeKid,
        channel: "api_gateway",
      },
    }, req as any);

    const numericAmount = Number.parseFloat(toDecimalString((rec as any).amount));
    if (Number.isFinite(numericAmount) && Math.abs(numericAmount) >= DISCREPANCY_THRESHOLD) {
      const severity = Math.abs(numericAmount) >= DISCREPANCY_THRESHOLD * 2 ? "critical" : "high";
      await publishOperationalEvent(app, {
        subject: operationalSubjects.ledger.discrepancyDetected,
        eventType: "ledger.discrepancy.detected",
        orgId: data.orgId,
        key: rec.id,
        dedupeId: data.idempotencyKey ?? undefined,
        payload: {
          bankLineId: rec.id,
          amount: toDecimalString((rec as any).amount),
          detectedAt: rec.date.toISOString(),
          threshold: DISCREPANCY_THRESHOLD,
          severity,
          status: "OPEN",
          category: "cash_flow",
          detectedBy: "bank_line_threshold",
          reason: `Amount ${numericAmount.toFixed(2)} exceeded threshold ${DISCREPANCY_THRESHOLD}`,
          idempotencyKey: data.idempotencyKey,
          payeeKey: rec.payeeKid,
        },
      }, req as any);
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
