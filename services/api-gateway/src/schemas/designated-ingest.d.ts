import { z } from "zod";
export declare const contributionSchema: z.ZodObject<{
    orgId: z.ZodString;
    amount: z.ZodNumber;
    source: z.ZodOptional<z.ZodString>;
    actorId: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export declare const precheckSchema: z.ZodObject<{
    orgId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=designated-ingest.d.ts.map