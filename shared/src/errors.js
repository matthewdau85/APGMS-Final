export class AppError extends Error {
    constructor(status, code, message, fields) {
        super(message);
        this.name = "AppError";
        this.status = status;
        this.code = code;
        this.fields = fields;
    }
}
const toFieldErrors = (issues) => issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
}));
export const createError = (status, code, message, fields) => new AppError(status, code, message, fields);
export const badRequest = (code, message, fields) => createError(400, code, message, fields);
export const unauthorized = (code, message) => createError(401, code, message);
export const forbidden = (code, message) => createError(403, code, message);
export const notFound = (code, message) => createError(404, code, message);
export const conflict = (code, message) => createError(409, code, message);
export const validationError = (error) => {
    if (Array.isArray(error)) {
        return badRequest("invalid_body", "Validation failed", error);
    }
    return badRequest("invalid_body", "Validation failed", toFieldErrors(error.issues));
};
//# sourceMappingURL=errors.js.map