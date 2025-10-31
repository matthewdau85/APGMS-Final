import { z } from "zod";

const trimmed = () => z.string().trim().min(1);

export const LoginBodySchema = z
  .object({
    email: trimmed().email(),
    password: z.string().min(8).max(128),
  })
  .strict();

export const BankLineCreateSchema = z
  .object({
    date: z.string().datetime({ offset: true }),
    amount: z
      .union([z.string(), z.number()])
      .transform((value) => (typeof value === "number" ? value.toString() : value.trim()))
      .refine((value) => /^-?\d+(\.\d{1,2})?$/.test(value), "Amount must be a decimal with up to 2 places"),
    payee: trimmed().max(120),
    desc: trimmed().max(512),
  })
  .strict();

export const OrgScopedParamsSchema = z
  .object({
    orgId: trimmed(),
  })
  .strict();

export const AlertResolveBodySchema = z
  .object({
    note: trimmed().max(1000),
    mfaCode: z.string().trim().min(6).max(12).optional(),
  })
  .strict();

export const AlertResolveParamsSchema = z
  .object({
    id: trimmed(),
  })
  .strict();

export const BasPaymentPlanQuerySchema = z
  .object({
    basCycleId: trimmed().optional(),
  })
  .strict();

export const BasPaymentPlanBodySchema = z
  .object({
    basCycleId: trimmed(),
    reason: trimmed().max(500),
    weeklyAmount: z
      .union([z.number(), z.string()])
      .transform((value) => (typeof value === "number" ? value : Number.parseFloat(value)))
      .refine((value) => Number.isFinite(value) && value > 0, "weeklyAmount must be a positive number"),
    startDate: z.string().datetime({ offset: true }),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const BasLodgeBodySchema = z
  .object({
    mfaCode: z.string().trim().min(6).max(12).optional(),
  })
  .strict();

export const TotpConfirmBodySchema = z
  .object({
    token: z.string().trim().min(6).max(12),
  })
  .strict();

export const MfaStepUpBodySchema = z
  .object({
    code: z.string().trim().min(6).max(12),
  })
  .strict();

const PasskeyRegistrationPayloadSchema = z
  .object({
    credential: z.unknown().optional(),
    response: z.unknown().optional(),
  })
  .strict()
  .refine((payload) => payload.credential !== undefined || payload.response !== undefined, {
    message: "registration payload is required",
  });

export const PasskeyRegistrationBodySchema = PasskeyRegistrationPayloadSchema;

const PasskeyAuthenticationPayloadSchema = z
  .object({
    credential: z.unknown().optional(),
    response: z.unknown().optional(),
  })
  .strict()
  .refine((payload) => payload.credential !== undefined || payload.response !== undefined, {
    message: "authentication payload is required",
  });

export const PasskeyVerifyBodySchema = PasskeyAuthenticationPayloadSchema;
