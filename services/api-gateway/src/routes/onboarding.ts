import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  badRequest,
  notFound,
  unauthorized,
} from "@apgms/shared";

import { prisma } from "../db.js";
import { parseWithSchema } from "../lib/validation.js";
import { recordAuditLog } from "../lib/audit.js";

const validateAbnTfnSchema = z.object({
  abn: z.string().min(1),
  tfn: z.string().min(1),
});

const onboardingSetupSchema = z.object({
  abn: z.string().min(1),
  tfn: z.string().min(1),
  bankProvider: z.enum(["cba", "nab", "anz"]),
  schedule: z.enum(["TRANSACTION", "DAILY", "WEEKLY"]),
  accounts: z
    .object({
      paygw: z.string().optional(),
      gst: z.string().optional(),
      paygi: z.string().optional(),
    })
    .default({}),
});

const TFN_MASK = "***masked***";

function normalizeDigits(value: string): string {
  return value.replace(/\s+/g, "");
}

function maskAccount(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, "");
  if (trimmed.length <= 4) {
    return "****";
  }
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

type DesignatedAccountClient = Pick<
  Prisma.TransactionClient,
  "designatedAccount"
>;

async function ensureDesignatedAccounts(
  client: DesignatedAccountClient,
  orgId: string,
) {
  const targetTypes: Array<"PAYGW" | "GST"> = ["PAYGW", "GST"];
  const accounts = [] as Array<{ id: string; type: string; balance: number; updatedAt: Date }>;

  for (const type of targetTypes) {
    const existing = await client.designatedAccount.findFirst({
      where: { orgId, type },
    });
    let record = existing;
    if (!record) {
      record = await client.designatedAccount.create({
        data: { orgId, type },
      });
    } else {
      record = await client.designatedAccount.update({
        where: { id: record.id },
        data: { updatedAt: new Date() },
      });
    }
    accounts.push({
      id: record.id,
      type: record.type,
      balance: Number(record.balance ?? 0),
      updatedAt: record.updatedAt,
    });
  }

  return accounts;
}

export async function registerOnboardingRoutes(app: FastifyInstance) {
  app.post("/onboarding/validate", async (request, reply) => {
    const { abn, tfn } = parseWithSchema(validateAbnTfnSchema, request.body);

    const normalizedAbn = normalizeDigits(abn);
    const normalizedTfn = normalizeDigits(tfn);

    if (!/^\d{11}$/.test(normalizedAbn)) {
      throw badRequest("invalid_abn", "ABN must contain 11 digits");
    }
    if (!/^\d{8,9}$/.test(normalizedTfn)) {
      throw badRequest("invalid_tfn", "TFN must contain 8 or 9 digits");
    }

    request.log.info({ abn: normalizedAbn, tfn: TFN_MASK }, "onboarding_validate");

    reply.send({
      ok: true,
      abn: normalizedAbn,
      obligations: [
        { type: "PAYGW", description: "PAYGW withholding obligations" },
        { type: "GST", description: "GST net remittance" },
      ],
    });
  });

  app.post("/onboarding/setup", async (request, reply) => {
    const body = parseWithSchema(onboardingSetupSchema, request.body);
    const user = request.user;
    if (!user) {
      throw unauthorized("auth_required", "Authentication required");
    }

    const normalizedAbn = normalizeDigits(body.abn);
    const normalizedTfn = normalizeDigits(body.tfn);

    if (!/^\d{11}$/.test(normalizedAbn)) {
      throw badRequest("invalid_abn", "ABN must contain 11 digits");
    }
    if (!/^\d{8,9}$/.test(normalizedTfn)) {
      throw badRequest("invalid_tfn", "TFN must contain 8 or 9 digits");
    }

    const setupResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const org = await tx.org.findUnique({
        where: { id: user.orgId },
        select: { id: true, name: true },
      });
      if (!org) {
        throw notFound("org_missing", "Organisation not found");
      }

      const designatedAccounts = await ensureDesignatedAccounts(tx, user.orgId);

      const updatedOrg = await tx.org.update({
        where: { id: user.orgId },
        data: { onboardingComplete: true },
        select: { id: true, onboardingComplete: true, name: true },
      });

      return { org: updatedOrg, designatedAccounts };
    });

    await recordAuditLog({
      orgId: user.orgId,
      actorId: user.sub,
      action: "onboarding.setup",
      metadata: {
        bankProvider: body.bankProvider,
        schedule: body.schedule,
        abn: normalizedAbn,
        tfn: TFN_MASK,
        accounts: {
          paygw: maskAccount(body.accounts.paygw),
          gst: maskAccount(body.accounts.gst),
          paygi: maskAccount(body.accounts.paygi),
        },
      },
    });

    reply.code(201).send({
      org: setupResult.org,
      onboardingComplete: setupResult.org.onboardingComplete,
      designatedAccounts: setupResult.designatedAccounts,
      bankProvider: body.bankProvider,
      schedule: body.schedule,
    });
  });
}
