import { z } from "zod";
export declare const complianceTransferSchema: z.ZodObject<{
    orgId: z.ZodOptional<z.ZodString>;
    paygwAmount: z.ZodDefault<z.ZodNumber>;
    gstAmount: z.ZodDefault<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=compliance-transfer.d.ts.map