import { z } from "zod";

const isoDateString = z
  .string()
  .min(1, "date is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "date must be an ISO 8601 string",
  });

export const bankLineQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).default(20),
  from: isoDateString.optional(),
  to: isoDateString.optional(),
});

export const createBankLineSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  amount: z.coerce.number().finite("amount must be a finite number"),
  date: isoDateString,
  memo: z.string().max(1024, "memo must be 1024 characters or fewer").optional(),
});

export type BankLineQuery = z.infer<typeof bankLineQuerySchema>;
export type CreateBankLineInput = z.infer<typeof createBankLineSchema>;
