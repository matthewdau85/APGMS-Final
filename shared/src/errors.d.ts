import { ZodError } from "zod";
export type FieldError = {
    path: string;
    message: string;
};
export declare class AppError extends Error {
    readonly status: number;
    readonly code: string;
    readonly fields?: FieldError[];
    constructor(status: number, code: string, message: string, fields?: FieldError[]);
}
export declare const createError: (status: number, code: string, message: string, fields?: FieldError[]) => AppError;
export declare const badRequest: (code: string, message: string, fields?: FieldError[]) => AppError;
export declare const unauthorized: (code: string, message: string) => AppError;
export declare const forbidden: (code: string, message: string) => AppError;
export declare const notFound: (code: string, message: string) => AppError;
export declare const conflict: (code: string, message: string) => AppError;
export declare const validationError: (error: ZodError | FieldError[]) => AppError;
//# sourceMappingURL=errors.d.ts.map