import { z } from "zod";

const relationshipsItemSchema = z
  .object({
    type: z.string().min(1),
    id: z.string().min(1),
  })
  .strict();

const relationshipsSchema = z
  .object({
    relationships: z.array(relationshipsItemSchema),
  })
  .strict();

export const adminDataExportRequestSchema = z
  .object({
    subjectId: z.string().min(1),
  })
  .strict();

export const adminDataExportResponseSchema = z
  .object({
    version: z.string().min(1),
    subjectId: z.string().min(1),
    exportedAt: z.string().datetime(),
    data: relationshipsSchema,
  })
  .strict();

export const adminDataDeleteRequestSchema = z
  .object({
    subjectId: z.string().min(1),
  })
  .strict();

export const adminDataDeleteResponseSchema = z
  .object({
    status: z.literal("deleted"),
    subjectId: z.string().min(1),
    deletedAt: z.string().datetime(),
  })
  .strict();

export const adminDataErrorResponseSchema = z
  .object({
    error: z.string(),
  })
  .strict();

export type AdminDataExportRequest = z.infer<typeof adminDataExportRequestSchema>;
export type AdminDataExportResponse = z.infer<typeof adminDataExportResponseSchema>;
export type AdminDataDeleteRequest = z.infer<typeof adminDataDeleteRequestSchema>;
export type AdminDataDeleteResponse = z.infer<typeof adminDataDeleteResponseSchema>;
export type AdminDataErrorResponse = z.infer<typeof adminDataErrorResponseSchema>;

export const adminDataExportRequestJsonSchema = {
  $id: "AdminDataExportRequest",
  type: "object",
  additionalProperties: false,
  required: ["subjectId"],
  properties: {
    subjectId: { type: "string", minLength: 1 },
  },
} as const;

export const adminDataExportResponseJsonSchema = {
  $id: "AdminDataExportResponse",
  type: "object",
  additionalProperties: false,
  required: ["version", "subjectId", "exportedAt", "data"],
  properties: {
    version: { type: "string", minLength: 1 },
    subjectId: { type: "string", minLength: 1 },
    exportedAt: { type: "string", format: "date-time" },
    data: {
      type: "object",
      additionalProperties: false,
      required: ["relationships"],
      properties: {
        relationships: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "id"],
            properties: {
              type: { type: "string", minLength: 1 },
              id: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
  },
} as const;

export const adminDataDeleteRequestJsonSchema = {
  $id: "AdminDataDeleteRequest",
  type: "object",
  additionalProperties: false,
  required: ["subjectId"],
  properties: {
    subjectId: { type: "string", minLength: 1 },
  },
} as const;

export const adminDataDeleteResponseJsonSchema = {
  $id: "AdminDataDeleteResponse",
  type: "object",
  additionalProperties: false,
  required: ["status", "subjectId", "deletedAt"],
  properties: {
    status: { const: "deleted" },
    subjectId: { type: "string", minLength: 1 },
    deletedAt: { type: "string", format: "date-time" },
  },
} as const;

export const adminDataErrorResponseJsonSchema = {
  $id: "AdminDataErrorResponse",
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: { type: "string" },
  },
} as const;
