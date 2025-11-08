import { z } from "zod";

export const RegulatorLoginSchema = z
  .object({
    accessCode: z.string().trim().min(1, "accessCode is required"),
    orgId: z.string().trim().min(1).optional(),
  })
  .strict();

export type RegulatorLoginInput = z.infer<typeof RegulatorLoginSchema>;
