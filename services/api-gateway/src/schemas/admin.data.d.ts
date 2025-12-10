import { z } from "zod";
export declare const adminDataDeleteRequestSchema: z.ZodObject<{
    orgId: z.ZodString;
    email: z.ZodString;
    confirm: z.ZodLiteral<"DELETE">;
}, z.core.$strip>;
export declare const adminDataDeleteResponseSchema: z.ZodObject<{
    action: z.ZodUnion<readonly [z.ZodLiteral<"anonymized">, z.ZodLiteral<"deleted">]>;
    userId: z.ZodString;
    occurredAt: z.ZodString;
}, z.core.$strip>;
export type AdminDataDeleteRequest = z.infer<typeof adminDataDeleteRequestSchema>;
export type AdminDataDeleteResponse = z.infer<typeof adminDataDeleteResponseSchema>;
export declare const subjectDataExportRequestSchema: z.ZodObject<{
    orgId: z.ZodString;
    email: z.ZodString;
}, z.core.$strip>;
export declare const subjectDataExportResponseSchema: z.ZodObject<{
    org: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>;
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>;
    relationships: z.ZodObject<{
        bankLinesCount: z.ZodNumber;
    }, z.core.$strip>;
    exportedAt: z.ZodString;
}, z.core.$strip>;
export type SubjectDataExportRequest = z.infer<typeof subjectDataExportRequestSchema>;
export type SubjectDataExportResponse = z.infer<typeof subjectDataExportResponseSchema>;
//# sourceMappingURL=admin.data.d.ts.map