import { z } from "zod";

export const bankLinesQuerySchema = z
  .object({
    take: z.coerce.number().int().min(1).max(200).default(20),
    skip: z.coerce.number().int().min(0).default(0),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .partial({ startDate: true, endDate: true });

export type BankLinesQueryInput = z.infer<typeof bankLinesQuerySchema>;

export const createBankLineSchema = z.object({
  amount: z.coerce.number().finite(),
  date: z.string().datetime(),
  memo: z.string().trim().max(1024).optional(),
});

export type CreateBankLineInput = z.infer<typeof createBankLineSchema>;
