import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { assertOrgAccess, redactBankLine } from "../utils/orgScope.js";
import { extractTraceId } from "../utils/request-context.js";

// Accept the fields Prisma requires for a BankLine create
const createBankLineSchema = z.object({
  orgId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  amount: z.number(),
  // Accept ISO string or Date and coerce to Date
  date: z.preprocess(
    (v) => (typeof v === "string" || v instanceof Date ? new Date(v as any) : v),
    z.date(),
  ),
  payeeCiphertext: z.string().min(1),
  payeeKid: z.string().min(1),
  descCiphertext: z.string().min(1),
  descKid: z.string().min(1),
});

const DRIFT_THRESHOLD = 5_000;

const decimalToNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof (value as any)?.toNumber === "function") {
    return (value as any).toNumber() as number;
  }
  return Number(value);
};

const calculateDrift = async (orgId: string) => {
  const [designated, ledger] = await Promise.all([
    prisma.designatedAccount.aggregate({
      _sum: { balance: true },
      where: { orgId },
    }),
    prisma.bankLine.aggregate({
      _sum: { amount: true },
      where: { orgId },
    }),
  ]);

  const designatedTotal = decimalToNumber(designated._sum.balance);
  const ledgerTotal = decimalToNumber(ledger._sum.amount);
  const drift = ledgerTotal - designatedTotal;

  return {
    designatedTotal,
    ledgerTotal,
    drift,
    breached: Math.abs(drift) >= DRIFT_THRESHOLD,
  };
};

export const registerBankLinesRoutes: FastifyPluginAsync = async (app) => {
  // Create (idempotent on (orgId, idempotencyKey))
  app.post("/bank-lines", async (req, reply) => {
    // Authorize org access for the caller's org
    const user = (req as any).user!;
    assertOrgAccess(req, reply, user.orgId);

    const parsed = createBankLineSchema.safeParse(req.body);
    if (!parsed.success) {
      app.metrics?.recordSecurityEvent?.("bank_lines.validation_failed");
      const traceId = extractTraceId(req);
      await app.riskEvents?.publishValidationFailure({
        orgId: user.orgId,
        actorId: user.sub,
        requestId: String(req.id),
        traceId,
        payload: {
          route: "/bank-lines",
          reason: "schema_validation_failed",
          issues: parsed.error.flatten(),
        },
      });
      reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;

    // Enforce caller may only write to their own org
    if (data.orgId !== user.orgId) {
      app.metrics?.recordSecurityEvent?.("bank_lines.foreign_org_access");
      const traceId = extractTraceId(req);
      await app.riskEvents?.publishOverride({
        orgId: user.orgId,
        actorId: user.sub,
        requestId: String(req.id),
        traceId,
        payload: {
          route: "/bank-lines",
          reason: "foreign_org_write_attempt",
          attemptedOrgId: data.orgId,
        },
        severity: "critical",
      });
      reply.code(403).send({ error: "forbidden" });
      return;
    }

    const traceId = extractTraceId(req);
    const existing = await prisma.bankLine.findUnique({
      where: {
        orgId_idempotencyKey: {
          orgId: data.orgId,
          idempotencyKey: data.idempotencyKey,
        },
      },
    });
    if (existing) {
      const differences = {
        amount: decimalToNumber(existing.amount) !== data.amount,
        date: existing.date.toISOString() !== data.date.toISOString(),
        payee: existing.payeeCiphertext !== data.payeeCiphertext,
        description: existing.descCiphertext !== data.descCiphertext,
      };
      if (differences.amount || differences.date || differences.payee || differences.description) {
        app.metrics?.recordSecurityEvent?.("bank_lines.override_attempt");
        await app.riskEvents?.publishOverride({
          orgId: data.orgId,
          actorId: user.sub,
          requestId: String(req.id),
          traceId,
          key: `${data.orgId}:${data.idempotencyKey}`,
          payload: {
            route: "/bank-lines",
            idempotencyKey: data.idempotencyKey,
            prior: redactBankLine(existing),
            attempted: {
              amount: data.amount,
              date: data.date.toISOString(),
              payeeCiphertext: data.payeeCiphertext,
              descCiphertext: data.descCiphertext,
            },
          },
        });
      }
    }

    const rec = await prisma.bankLine.upsert({
      where: {
        orgId_idempotencyKey: {
          orgId: data.orgId,
          idempotencyKey: data.idempotencyKey,
        },
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
        descKid: data.descKid,
      },
    });

    const drift = await calculateDrift(data.orgId);
    if (drift.breached) {
      const severity = Math.abs(drift.drift) >= DRIFT_THRESHOLD * 5 ? "critical" : "high";
      const recommendedDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await app.riskEvents?.publishBalanceDrift({
        orgId: data.orgId,
        actorId: user.sub,
        requestId: String(req.id),
        traceId,
        key: `${data.orgId}:${rec.id}:balance`,
        payload: {
          route: "/bank-lines",
          bankLineId: rec.id,
          ledgerTotal: drift.ledgerTotal,
          designatedTotal: drift.designatedTotal,
          driftAmount: drift.drift,
          threshold: DRIFT_THRESHOLD,
          recommendedCommitment: {
            dueDate: recommendedDueDate.toISOString(),
            amount: Math.abs(drift.drift),
            rationale: "Auto-generated from bank line ingestion drift check",
          },
        },
        severity,
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
      orderBy: { createdAt: "desc" },
    });

    reply.send({ lines: rows.map(redactBankLine) });
  });
};

export default registerBankLinesRoutes;
