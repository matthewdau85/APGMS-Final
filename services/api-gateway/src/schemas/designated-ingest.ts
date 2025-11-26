import { z } from "zod";

export const contributionSchema = z.object({
  orgId: z.string().min(1),
  amount: z.number().positive(),
  source: z.string().min(1).optional(),
  actorId: z.string().optional(),
  payload: z.unknown().optional(),
});

export const precheckSchema = z.object({
  orgId: z.string().min(1).optional(),
});
