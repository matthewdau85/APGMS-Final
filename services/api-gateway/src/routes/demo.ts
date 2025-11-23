import { Decimal, JsonValue } from "@prisma/client/runtime/library.js";
import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authGuard } from "../auth.js";
import { prisma } from "../db.js";
import { forbidden } from "@apgms/shared";
import { recordAuditLog } from "../lib/audit.js";
import { encryptPII } from "../lib/pii.js";

const DEMO_ORG_ID = process.env.DEV_ADMIN_ORG_ID?.trim() ?? "demo-org";
const MOCK_DATE = process.env.DEMO_MOCK_DATE ? new Date(process.env.DEMO_MOCK_DATE) : new Date();

const bankSchema = z.object({
  daysBack: z.number().int().min(1).max(30).optional(),
  intensity: z.enum(["low", "high"]).optional(),
});

const payrollSchema = z.object({
  includeBankLines: z.boolean().optional(),
  note: z.string().optional(),
});

const basSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

type DemoUser = {
  orgId: string;
  role: "admin";
  sub: string;
};

function ensureDemoOrg(request: FastifyRequest): DemoUser {
  const user = (request as any).user as { orgId?: string; role?: string; sub?: string } | undefined;
  if (!user || user.orgId !== DEMO_ORG_ID || user.role !== "admin" || !user.sub) {
    throw forbidden("demo_restricted", "Demo endpoints are limited to the admin demo org");
  }
  return { orgId: user.orgId, role: "admin", sub: user.sub };
}

function auditMetadata(payload?: Record<string, unknown>) {
  if (!payload) return null;
  return JSON.parse(JSON.stringify(payload)) as JsonValue;
}

function createBankLinePayload(orgId: string, index: number, daysBack: number, intensity: "low" | "high") {
  const base = new Date(MOCK_DATE);
  base.setUTCDate(base.getUTCDate() - daysBack + index);
  const dateLabel = base.toISOString().split("T")[0];
  const amount =
    index % 2 === 0 ? 1200 + (intensity === "high" ? 400 : 0) : -(600 + (intensity === "high" ? 200 : 0));
  const payeeText = amount >= 0 ? "Demo POS Sale" : "Demo Payroll Settlement";
  const descText = amount >= 0 ? `POS ${dateLabel}` : `Payroll ${dateLabel}`;
  const payee = encryptPII(payeeText);
  const desc = encryptPII(descText);

  return {
    orgId,
    idempotencyKey: `demo:${dateLabel}:${amount}`,
    amount,
    date: base,
    payeeCiphertext: payee.ciphertext,
    payeeKid: payee.kid,
    descCiphertext: desc.ciphertext,
    descKid: desc.kid,
    tag: amount >= 0 ? "income" : "payroll",
  };
}

async function adjustDesignatedAccount(orgId: string, type: "PAYGW" | "GST", amount: number) {
  const account = await prisma.designatedAccount.findFirst({ where: { orgId, type } });
  if (!account) return;
  const newBalance = new Decimal(account.balance ?? 0).add(new Decimal(amount));
  await prisma.designatedAccount.update({
    where: { id: account.id },
    data: {
      balance: newBalance.toFixed(8),
      updatedAt: new Date(),
    },
  });
}

export async function registerDemoRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authGuard);

  app.post("/demo/banking/generate", async (request, reply) => {
    const user = ensureDemoOrg(request);
    const parsed = bankSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "invalid_body", details: parsed.error.flatten() } });
    }
    const options = parsed.data;
    const daysBack = options.daysBack ?? 7;
    const intensity = options.intensity ?? "low";

    const rows = [];
    let generated = 0;
    for (let index = 0; index < daysBack; index += 1) {
      const payload = createBankLinePayload(user.orgId, index, daysBack, intensity);
      try {
        const created = await prisma.bankLine.create({
          data: {
            orgId: payload.orgId,
            idempotencyKey: payload.idempotencyKey,
            amount: new Decimal(payload.amount),
            date: payload.date,
            payeeCiphertext: payload.payeeCiphertext,
            payeeKid: payload.payeeKid,
            descCiphertext: payload.descCiphertext,
            descKid: payload.descKid,
            tag: payload.tag,
          },
        });
        rows.push({ id: created.id, amount: created.amount.toNumber(), date: created.date.toISOString() });
        generated += 1;
      } catch (err) {
        // Ignore duplicates due to idempotency
      }
    }

    await adjustDesignatedAccount(user.orgId, "PAYGW", rows.filter((r) => r.amount < 0).reduce((sum, r) => sum + r.amount, 0));
    await adjustDesignatedAccount(user.orgId, "GST", rows.filter((r) => r.amount > 0).reduce((sum, r) => sum + r.amount, 0));

    const summary = {
      note: `Generated ${generated} demo rows (${intensity}) for ${daysBack} days back`,
      generated,
      intensity,
      range: `${daysBack} days`,
      rows,
    };

    await recordAuditLog({
      orgId: user.orgId,
      actorId: user.sub,
      action: "demo_bank_feed_generate",
      metadata: auditMetadata(summary),
    });

    reply.send(summary);
  });

  app.post("/demo/payroll/run", async (request, reply) => {
    const user = ensureDemoOrg(request);
    const parsed = payrollSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "invalid_body", details: parsed.error.flatten() } });
    }
    const payload = parsed.data;

    const payRunId = `demo-payrun-${Date.now()}`;
    const grossWages = 12000;
    const totalPaygWithheld = 3200;
    await prisma.payRun.create({
      data: {
        id: payRunId,
        orgId: user.orgId,
        runDate: new Date(),
        grossWages: new Decimal(grossWages),
        paygwCalculated: new Decimal(totalPaygWithheld),
        paygwSecured: new Decimal(totalPaygWithheld),
        status: "READY",
      },
    });

    if (payload.includeBankLines) {
      const payloadBank = createBankLinePayload(user.orgId, 0, 1, "low");
      await prisma.bankLine.create({
        data: {
          orgId: payloadBank.orgId,
          idempotencyKey: payloadBank.idempotencyKey,
          amount: new Decimal(payloadBank.amount),
          date: payloadBank.date,
          payeeCiphertext: payloadBank.payeeCiphertext,
          payeeKid: payloadBank.payeeKid,
          descCiphertext: payloadBank.descCiphertext,
          descKid: payloadBank.descKid,
          tag: payloadBank.tag,
        },
      });
    }

    const summary = {
      note: payload.note ?? "",
      payRunId,
      totalPaygWithheld,
      payslips: 10,
    };

    await recordAuditLog({
      orgId: user.orgId,
      actorId: user.sub,
      action: "demo_payroll_run",
      metadata: auditMetadata(summary),
    });

    reply.send(summary);
  });

  app.post("/demo/bas/compile", async (request, reply) => {
    const user = ensureDemoOrg(request);
    const parsed = basSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "invalid_body", details: parsed.error.flatten() } });
    }
    const payload = parsed.data;

    const gstCollected = 4200;
    const gstCredits = 1200;
    const netGst = gstCollected - gstCredits;
    const paygWithheld = 3200;

    const summary = {
      note: "Compiled demo BAS",
      period: { year: payload.year, month: payload.month },
      gstCollected,
      gstCredits,
      netGst,
      paygWithheld,
      bankLines: 12,
      payslips: 10,
    };

    await recordAuditLog({
      orgId: user.orgId,
      actorId: user.sub,
      action: "demo_bas_compile",
      metadata: auditMetadata(summary),
    });

    reply.send(summary);
  });
}
