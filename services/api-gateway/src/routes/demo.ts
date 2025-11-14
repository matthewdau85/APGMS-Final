import { Decimal, JsonValue } from "@prisma/client/runtime/library.js";
import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authGuard } from "../auth.js";
import { prisma } from "../db.js";
import { badRequest, forbidden } from "@apgms/shared";
import { recordAuditLog } from "../lib/audit.js";
import { encryptPII } from "../lib/pii.js";

const DEMO_ORG_ID = process.env.DEV_ADMIN_ORG_ID?.trim() ?? "demo-org";
const MOCK_DATE = process.env.DEMO_MOCK_DATE
  ? new Date(process.env.DEMO_MOCK_DATE)
  : new Date();

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
  const user = (request as any).user as
    | { orgId?: string; role?: string; sub?: string }
    | undefined;
  if (!user || user.orgId !== DEMO_ORG_ID || user.role !== "admin" || !user.sub) {
    throw forbidden("demo_restricted", "Demo endpoints are limited to the admin demo org");
  }
  return { orgId: user.orgId, role: "admin", sub: user.sub };
}

function auditMetadata(payload?: Record<string, unknown>) {
  if (!payload) return null;
  return JSON.parse(JSON.stringify(payload)) as JsonValue;
}

function createBankLinePayload(
  orgId: string,
  index: number,
  daysBack: number,
  intensity: "low" | "high",
) {
  const base = new Date(MOCK_DATE);
  base.setUTCDate(base.getUTCDate() - daysBack + index);
  const dateLabel = base.toISOString().split("T")[0];
  const amount =
    index % 2 === 0
      ? 1200 + (intensity === "high" ? 400 : 0)
      : -(600 + (intensity === "high" ? 200 : 0));
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

async function adjustDesignatedAccount(
  orgId: string,
  type: "PAYGW" | "GST",
  amount: number,
) {
  const account = await prisma.designatedAccount.findFirst({
    where: { orgId, type },
  });
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
    const options = bankSchema.parse(request.body);
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
          },
        });
        rows.push(created);
        generated += 1;
        if (payload.tag === "income") {
          await adjustDesignatedAccount(user.orgId, "GST", payload.amount * 0.1);
        }
        if (payload.tag === "payroll") {
          await adjustDesignatedAccount(user.orgId, "PAYGW", Math.abs(payload.amount));
        }
      } catch (error) {
        if (!(error instanceof Error)) continue;
      }
    }

    await recordAuditLog({
      orgId: user.orgId,
      actorId: user.sub,
      action: "demo.banking.generate",
      metadata: auditMetadata({ generated, intensity }),
    });

    reply.send({
      note: "Demo-only bank feeds; no real banking provider was touched.",
      generated,
      intensity,
      range: `${MOCK_DATE.toISOString().split("T")[0]} (-${daysBack}d)`,
      rows: rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        date: row.date.toISOString(),
      })),
    });
  });

  app.post("/demo/payroll/run", async (request, reply) => {
    const user = ensureDemoOrg(request);
    const options = payrollSchema.parse(request.body);
    const employees = await prisma.employee.findMany({
      where: { orgId: user.orgId },
    });
    if (!employees.length) {
      throw badRequest("demo_employees_missing", "Please seed demo employees first");
    }

    const now = new Date(MOCK_DATE);
    const payRun = await prisma.payRun.create({
      data: {
        id: `demo-payrun-${now.getTime()}`,
        orgId: user.orgId,
        periodStart: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        paymentDate: now,
        status: "committed",
      },
    });

    const payslips = [];
    let totalPayg = 0;
    for (const employee of employees.slice(0, 3)) {
      const gross = 4200;
      const paygWithheld = 0.2 * gross;
      const superAccrued = 0.095 * gross;
      const notes = encryptPII(`Demo payroll for ${employee.id}`);
      const slip = await prisma.payslip.create({
        data: {
          id: `${payRun.id}-${employee.id}`,
          payRunId: payRun.id,
          employeeId: employee.id,
          grossPay: new Decimal(gross),
          paygWithheld: new Decimal(paygWithheld),
          superAccrued: new Decimal(superAccrued),
          notesCiphertext: notes.ciphertext,
          notesKid: notes.kid,
        },
      });
      payslips.push(slip);
      totalPayg += paygWithheld;
    }
    await adjustDesignatedAccount(user.orgId, "PAYGW", totalPayg);

    await recordAuditLog({
      orgId: user.orgId,
      actorId: user.sub,
      action: "demo.payroll.run",
      metadata: auditMetadata({ payRunId: payRun.id, totalPayg, notes: options.note }),
    });

    if (options.includeBankLines) {
      const payee = encryptPII("Demo Payroll Settlement");
      const desc = encryptPII("Demo payroll settled");
      await prisma.bankLine.create({
        data: {
          orgId: user.orgId,
          idempotencyKey: `demo-payroll-bank-${payRun.id}`,
          amount: -totalPayg,
          date: now,
          payeeCiphertext: payee.ciphertext,
          payeeKid: payee.kid,
          descCiphertext: desc.ciphertext,
          descKid: desc.kid,
        },
      });
    }

    reply.send({
      note: "Demo payroll run completed.",
      payRunId: payRun.id,
      totalPaygWithheld: totalPayg,
      payslips: payslips.length,
    });
  });

  app.post("/demo/bas/compile", async (request, reply) => {
    const user = ensureDemoOrg(request);
    const options = basSchema.parse(request.body);
    const periodStart = new Date(Date.UTC(options.year, options.month - 1, 1));
    const periodEnd = new Date(Date.UTC(options.year, options.month, 0, 23, 59, 59));

    const bankLines = await prisma.bankLine.findMany({
      where: {
        orgId: user.orgId,
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });
    const payslips = await prisma.payslip.findMany({
      where: {
        payRun: {
          paymentDate: {
            gte: periodStart,
            lte: periodEnd,
          },
          orgId: user.orgId,
        },
      },
    });

    const income = bankLines
      .filter((line) => Number(line.amount) >= 0)
      .reduce((sum, line) => sum + Number(line.amount), 0);
    const expenses = bankLines
      .filter((line) => Number(line.amount) < 0)
      .reduce((sum, line) => sum + Number(line.amount), 0);
    const gstCollected = Number((income * 0.1).toFixed(2));
    const gstCredits = Number((Math.abs(expenses) * 0.05).toFixed(2));
    const totalPayg = Number(
      payslips.reduce((sum, slip) => sum + Number(slip.paygWithheld), 0).toFixed(2),
    );

    await recordAuditLog({
      orgId: user.orgId,
      actorId: user.sub,
      action: "demo.bas.compile",
      metadata: auditMetadata({
        period: `${options.year}-${options.month}`,
        gstCollected,
        gstCredits,
        totalPayg,
      }),
    });

    reply.send({
      note: "Demo BAS calculation (mocked values).",
      period: { year: options.year, month: options.month },
      gstCollected,
      gstCredits,
      netGst: Number((gstCollected - gstCredits).toFixed(2)),
      paygWithheld: totalPayg,
      bankLines: bankLines.length,
      payslips: payslips.length,
    });
  });
}
