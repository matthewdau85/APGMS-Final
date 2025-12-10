import { z } from "zod";
export declare const LoginBodySchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strict>;
export declare const BankLineCreateSchema: z.ZodObject<{
    date: z.ZodString;
    amount: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>;
    payee: z.ZodString;
    desc: z.ZodString;
}, z.core.$strict>;
export declare const OrgScopedParamsSchema: z.ZodObject<{
    orgId: z.ZodString;
}, z.core.$strict>;
export declare const AlertResolveBodySchema: z.ZodObject<{
    note: z.ZodString;
    mfaCode: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const AlertResolveParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strict>;
export declare const BasPaymentPlanQuerySchema: z.ZodObject<{
    basCycleId: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const BasPaymentPlanBodySchema: z.ZodObject<{
    basCycleId: z.ZodString;
    reason: z.ZodString;
    weeklyAmount: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>;
    startDate: z.ZodString;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export declare const BasLodgeBodySchema: z.ZodObject<{
    mfaCode: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const TotpConfirmBodySchema: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strict>;
export declare const MfaStepUpBodySchema: z.ZodObject<{
    code: z.ZodString;
}, z.core.$strict>;
export declare const PasskeyRegistrationBodySchema: z.ZodObject<{
    credential: z.ZodOptional<z.ZodUnknown>;
    response: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strict>;
export declare const PasskeyVerifyBodySchema: z.ZodObject<{
    credential: z.ZodOptional<z.ZodUnknown>;
    response: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strict>;
//# sourceMappingURL=api.d.ts.map