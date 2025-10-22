import { z } from "zod";

export const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO date"),
  amount: z.number(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO date"),
});

export const getBankLinesQuerySchema = z
  .object({
    take: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export const listBankLinesResponseSchema = z
  .object({
    lines: z.array(bankLineSchema),
  })
  .strict();

export const createBankLineBodySchema = z
  .object({
    date: z
      .string()
      .min(1)
      .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO date"),
    amount: z.number(),
    payee: z.string().min(1),
    desc: z.string().min(1),
  })
  .strict();

export const createBankLineHeadersSchema = z
  .object({
    idempotencyKey: z.string().min(1).max(64),
  })
  .strict();

export const createBankLineResponseSchema = z
  .object({
    line: bankLineSchema,
  })
  .strict();

export type BankLineResponse = z.infer<typeof bankLineSchema>;
