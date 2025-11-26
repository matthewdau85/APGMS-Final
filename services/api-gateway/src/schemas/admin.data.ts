import { z } from "zod";

export const adminDataDeleteRequestSchema = z.object({
  orgId: z.string().min(1, "orgId is required"),
  email: z.string().email("email must be valid"),
  confirm: z.literal("DELETE"),
});

export const adminDataDeleteResponseSchema = z.object({
  action: z.union([z.literal("anonymized"), z.literal("deleted")]),
  userId: z.string().min(1),
  occurredAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "occurredAt must be ISO string",
    }),
});

export type AdminDataDeleteRequest = z.infer<typeof adminDataDeleteRequestSchema>;
export type AdminDataDeleteResponse = z.infer<typeof adminDataDeleteResponseSchema>;

export const subjectDataExportRequestSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
});

const orgSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
});

const relationshipsSchema = z.object({
  bankLinesCount: z.number().int(),
});

export const subjectDataExportResponseSchema = z.object({
  org: orgSchema,
  user: userSchema,
  relationships: relationshipsSchema,
  exportedAt: z.string(),
});

export type SubjectDataExportRequest = z.infer<typeof subjectDataExportRequestSchema>;
export type SubjectDataExportResponse = z.infer<typeof subjectDataExportResponseSchema>;

