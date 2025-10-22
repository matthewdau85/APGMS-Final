import { z } from "zod";

export const BankLineQuerySchema = z
  .object({
    take: z.coerce.number().int().min(1).max(200).optional(),
  })
  .transform((data) => ({
    take: data.take ?? 20,
  }));

export type BankLineQuery = z.infer<typeof BankLineQuerySchema>;

export const BankLinePostSchema = z.object({
  date: z.string().datetime(),
  amount: z.coerce.number().finite(),
  payee: z.string().min(1).max(128),
  memo: z.string().max(256).optional(),
  desc: z.string().max(256).optional(),
});

export type BankLinePostInput = z.infer<typeof BankLinePostSchema>;
