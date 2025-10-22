import { z } from "zod";

export const errorSchema = z.object({
  error: z.string(),
  details: z.any().optional(),
});

export type ErrorShape = z.infer<typeof errorSchema>;

export const paginateQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
