// services/api-gateway/src/routes/onboarding.ts
// Onboarding routes: validate ABN/TFN and create designated accounts + PayTo.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { ERRORS } from "../errors.js";
import { withRetry } from "../lib/retry.js";
import { validateAbnTfn } from "../lib/ato.js";
import { createPayToProvider } from "../providers.js";

type Obligation = "PAYGW" | "GST" | "PAYGI";

type Schedule = "TRANSACTION" | "DAILY" | "WEEKLY";

interface OnboardingSetupBody {
  abn: string;
  tfn: string;
  bankProvider: string;
  schedule: Schedule;
  accounts?: {
    paygw?: string;
    gst?: string;
    paygi?: string;
  };
}

const VALID_SCHEDULES = new Set<Schedule>(["TRANSACTION", "DAILY", "WEEKLY"]);

export async function registerOnboardingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/onboarding/validate", async (request, reply) => {
    const { abn, tfn } = request.query as { abn?: string; tfn?: string };
    if (!abn || !tfn) {
      const e = ERRORS.INVALID_INPUT;
      reply.code(e.status).send({ error: e });
      return;
    }

    try {
      const result = await validateAbnTfn(abn, tfn);
      if (!result.valid) {
        const e = ERRORS.ABN_TFN_VALIDATION_FAILED;
        reply.code(e.status).send({ error: e });
        return;
      }
      reply.send({ obligations: result.obligations });
    } catch (error) {
      request.log.error({ err: error }, "abn_tfn_validation_failed");
      const e = ERRORS.EXTERNAL_SERVICE_ERROR;
      reply.code(e.status).send({ error: e });
    }
  });

  app.post("/onboarding/setup", async (request, reply) => {
    const body = request.body as OnboardingSetupBody;
    if (!body?.abn || !body.tfn || !body.bankProvider || !body.schedule) {
      const e = ERRORS.INVALID_INPUT;
      reply.code(e.status).send({ error: e });
      return;
    }

    if (!VALID_SCHEDULES.has(body.schedule)) {
      const e = ERRORS.INVALID_INPUT;
      reply.code(e.status).send({ error: { ...e, message: "Unknown schedule" } });
      return;
    }

    const user = request.user;
    if (!user?.orgId) {
      reply.code(401).send({ error: { code: "unauthorized" } });
      return;
    }

    let payto;
    try {
      payto = createPayToProvider(body.bankProvider);
    } catch (error) {
      request.log.warn({ err: error }, "unsupported_bank_provider");
      const e = ERRORS.INVALID_INPUT;
      reply.code(e.status).send({ error: { ...e, message: "Unsupported bank provider" } });
      return;
    }

    const organization = await prisma.org.update({
      where: { id: user.orgId },
      data: {
        abn: body.abn,
        tfn: body.tfn,
        paygwSchedule: body.schedule,
        gstSchedule: body.schedule,
        paygiSchedule: body.schedule,
      },
    });

    const accounts = body.accounts ?? {};
    const entries: Array<{ key: Obligation; account?: string }> = [
      { key: "PAYGW", account: accounts.paygw },
      { key: "GST", account: accounts.gst },
      { key: "PAYGI", account: accounts.paygi },
    ];

    for (const entry of entries) {
      const accountId = entry.account?.trim();
      if (!accountId) continue;

      const designated = await prisma.designatedAccount.upsert({
        where: {
          orgId_type: {
            orgId: organization.id,
            type: entry.key,
          },
        },
        create: {
          orgId: organization.id,
          type: entry.key,
          externalAccountId: accountId,
        },
        update: {
          externalAccountId: accountId,
        },
      });

      const mandateId = await withRetry(() => payto.createMandate(accountId));
      await prisma.designatedAccount.update({
        where: { id: designated.id },
        data: { mandateId },
      });
    }

    reply.code(201).send({ ok: true });
  });
}
