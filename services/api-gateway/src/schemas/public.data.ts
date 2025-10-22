import { z } from "zod";

export const usersResponseSchema = z
  .object({
    users: z.array(
      z
        .object({
          id: z.string(),
          email: z.string().email(),
          createdAt: z.string().datetime(),
        })
        .strict(),
    ),
  })
  .strict();

export type UsersResponse = z.infer<typeof usersResponseSchema>;

export const bankLinesQuerySchema = z
  .object({
    take: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export type BankLinesQuery = z.infer<typeof bankLinesQuerySchema>;

export const bankLineSchema = z
  .object({
    id: z.string(),
    date: z.string().datetime(),
    amount: z.string(),
    payee: z.string(),
    desc: z.string(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const bankLinesResponseSchema = z
  .object({
    lines: z.array(bankLineSchema),
  })
  .strict();

export type BankLinesResponse = z.infer<typeof bankLinesResponseSchema>;
