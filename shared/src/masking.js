// services/api-gateway/src/lib/masking.ts
const SENSITIVE_KEY_PATTERNS = [
    "password",
    "token",
    "secret",
    "key",
    "authorization",
    "cookie",
    "session",
    "database_url",
    "databaseurl",
    "dsn",
];
const MASK = "***redacted***";
function shouldMaskKey(key) {
    if (!key)
        return false;
    const normalised = key.toLowerCase();
    return SENSITIVE_KEY_PATTERNS.some((pattern) => normalised.includes(pattern));
}
function maskString(value) {
    if (!value) {
        return MASK;
    }
    if (value.length <= 8) {
        return MASK;
    }
    const start = value.slice(0, 4);
    const end = value.slice(-2);
    return `${start}${"*".repeat(Math.max(3, value.length - 6))}${end}`;
}
function maskPotentialSecret(value, key) {
    if (shouldMaskKey(key)) {
        return MASK;
    }
    if (/password|secret|token|key/i.test(value)) {
        return MASK;
    }
    if (/^postgres(?:ql)?:\/\//i.test(value) ||
        /^mongodb:\/\//i.test(value)) {
        return maskString(value);
    }
    if (value.length > 32) {
        return maskString(value);
    }
    return value;
}
export function maskValue(value, key) {
    if (value == null)
        return value;
    if (typeof value === "string") {
        return shouldMaskKey(key) ? MASK : maskPotentialSecret(value, key);
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    if (value instanceof Date) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => maskValue(item, key));
    }
    if (typeof value === "object") {
        return maskObject(value);
    }
    return value;
}
export function maskObject(input) {
    if (input == null) {
        return input;
    }
    if (Array.isArray(input)) {
        return input.map((value) => maskValue(value));
    }
    if (typeof input !== "object") {
        return maskValue(input);
    }
    const entries = Object.entries(input).map(([key, value]) => [key, maskValue(value, key)]);
    return Object.fromEntries(entries);
}
export function maskError(err) {
    if (err instanceof Error) {
        const serialised = {
            name: err.name,
            message: err.message,
        };
        if (err.stack) {
            serialised.stack = err.stack.split("\n").slice(0, 5).join("\n");
        }
        if (err.cause) {
            serialised.cause = maskValue(err.cause);
        }
        return maskObject(serialised);
    }
    if (typeof err === "object" && err !== null) {
        return maskObject(err);
    }
    return { error: maskValue(err) };
}
//# sourceMappingURL=masking.js.map