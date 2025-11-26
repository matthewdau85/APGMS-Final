import { z } from "zod";

export const complianceTransferSchema = z.object({
  orgId: z.string().min(1).optional(),
  paygwAmount: z
    .number()
    .min(0)
    .default(0),
  gstAmount: z
    .number()
    .min(0)
    .default(0),
  description: z.string().trim().optional(),
});
