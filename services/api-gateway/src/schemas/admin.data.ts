import type { FastifySchema } from "fastify";
import { z } from "zod";

const isoDateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "value must be an ISO-8601 date-time string",
  });

export const adminDataExportRequestSchema = z.object({
  subjectId: z.string().min(1, "subjectId is required"),
});

export const adminDataExportResponseSchema = z.object({
  version: z.string().min(1),
  exportedAt: isoDateString,
  subject: z.object({
    id: z.string().min(1),
    orgId: z.string().min(1),
    createdAt: isoDateString,
  }),
  metadata: z.object({
    redactedFields: z.array(z.string().min(1)).min(1),
  }),
  relationships: z.object({
    bankLineCount: z.number().int().nonnegative(),
  }),
});

export const adminDataDeleteRequestSchema = z.object({
  subjectId: z.string().min(1, "subjectId is required"),
});

export const adminDataDeleteResponseSchema = z.object({
  status: z.literal("deleted"),
  subjectId: z.string().min(1),
  deletedAt: isoDateString,
});

export type AdminDataExportRequest = z.infer<typeof adminDataExportRequestSchema>;
export type AdminDataExportResponse = z.infer<typeof adminDataExportResponseSchema>;
export type AdminDataDeleteRequest = z.infer<typeof adminDataDeleteRequestSchema>;
export type AdminDataDeleteResponse = z.infer<typeof adminDataDeleteResponseSchema>;

const bearerSecurity = [{ bearerAuth: [] }];

const errorSchema = (code: string) => ({
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: { type: "string", enum: [code] },
  },
});

const subjectSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "orgId", "createdAt"],
  properties: {
    id: { type: "string" },
    orgId: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
} as const;

const metadataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["redactedFields"],
  properties: {
    redactedFields: {
      type: "array",
      minItems: 1,
      items: { type: "string" },
    },
  },
} as const;

const relationshipsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bankLineCount"],
  properties: {
    bankLineCount: { type: "integer", minimum: 0 },
  },
} as const;

export const adminDataExportRouteSchema: FastifySchema = {
  summary: "Export subject data", 
  description: "Returns a redacted JSON export bundle for the requested subject.",
  tags: ["admin"],
  security: bearerSecurity,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["subjectId"],
    properties: {
      subjectId: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["version", "exportedAt", "subject", "metadata", "relationships"],
      properties: {
        version: { type: "string" },
        exportedAt: { type: "string", format: "date-time" },
        subject: subjectSchema,
        metadata: metadataSchema,
        relationships: relationshipsSchema,
      },
    },
    400: errorSchema("invalid_request"),
    401: errorSchema("unauthorized"),
    404: errorSchema("not_found"),
  },
};

export const adminDataDeleteRouteSchema: FastifySchema = {
  summary: "Delete subject data",
  description: "Creates a privacy tombstone for the subject and deletes live records.",
  tags: ["admin"],
  security: bearerSecurity,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["subjectId"],
    properties: {
      subjectId: { type: "string", minLength: 1 },
    },
  },
  response: {
    202: {
      type: "object",
      additionalProperties: false,
      required: ["status", "subjectId", "deletedAt"],
      properties: {
        status: { type: "string", enum: ["deleted"] },
        subjectId: { type: "string" },
        deletedAt: { type: "string", format: "date-time" },
      },
    },
    400: errorSchema("invalid_request"),
    401: errorSchema("unauthorized"),
    404: errorSchema("not_found"),
  },
};
