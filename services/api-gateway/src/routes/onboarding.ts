import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { badRequest } from "@apgms/shared";

import { isValidABN, normalizeAbn, isValidTFN } from "../lib/au.js";

import { parseWithSchema } from "../lib/validation.js";
import { tokenizeTFN, encryptPII } from "../lib/pii.js";
import { recordAuditLog } from "../lib/audit.js";
import { resolvePayToProvider } from "../lib/payto-client.js";
import type { PayToProvider } from "../../../providers/payto/index.js";

const BankSchema = z.object({
  accountName: z.string().min(1).max(120),
  bsb: z.string().regex(/^\d{6}$/),
  accountNumber: z.string().regex(/^\d{6,10}$/),
  verificationAmountCents: z.number().int().positive().max(5_000_00).optional(),
  description: z.string().min(1).max(200).optional(),
});

const OnboardingRequestSchema = z.object({
  abn: z.string().min(11).max(20),
  tfn: z.string().min(8).max(12),
  orgName: z.string().min(1).max(200),
  contactEmail: z.string().email().optional(),
  bank: BankSchema,
});

type OnboardingDeps = {
  payToProvider?: PayToProvider;
  auditLogger?: typeof recordAuditLog;
};

export async function registerOnboardingRoutes(
  app: FastifyInstance,
  deps: OnboardingDeps = {},
): Promise<void> {
  app.post(
    "/onboarding/validate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = parseWithSchema(OnboardingRequestSchema, request.body);
      const normalizedAbn = normalizeAbn(payload.abn);
      if (!isValidABN(normalizedAbn)) {
        throw badRequest("invalid_abn", "ABN failed checksum validation");
      }

      const normalizedTfn = payload.tfn.replace(/\s+/g, "");
      if (!isValidTFN(normalizedTfn)) {
        throw badRequest("invalid_tfn", "TFN failed validation");
      }

      const tfnToken = tokenizeTFN(normalizedTfn);
      const secret = encryptPII(normalizedTfn);

      const payToProvider = deps.payToProvider ?? resolvePayToProvider();
      const bank = payload.bank;
      let mandate;
      try {
        mandate = await payToProvider.initiateMandate({
          orgId: normalizedAbn,
          accountName: bank.accountName,
          bsb: bank.bsb,
          accountNumber: bank.accountNumber,
          amountCents: bank.verificationAmountCents ?? 100,
          description:
            bank.description ??
            `Verify onboarding settlement account for ${payload.orgName}`,
          reference: `verify-${normalizedAbn}`,
          contactEmail: payload.contactEmail,
        });
      } catch (error) {
        request.log.error({ err: error }, "payto_mandate_failed");
        reply.code(502).send({ error: { code: "payto_unavailable" } });
        return;
      }

      const auditLogger = deps.auditLogger ?? recordAuditLog;
      await auditLogger({
        orgId: normalizedAbn,
        actorId: `onboarding:${normalizedAbn}`,
        action: "onboarding.validate",
        metadata: {
          abn: normalizedAbn,
          orgName: payload.orgName,
          tfnToken,
          payToProvider: mandate.provider,
          mandateId: mandate.mandateId,
        },
      });

      reply.send({
        status: "validated",
        abn: normalizedAbn,
        orgName: payload.orgName,
        contactEmail: payload.contactEmail ?? null,
        tfnToken,
        secret,
        mandate,
      });
    },
  );
}
