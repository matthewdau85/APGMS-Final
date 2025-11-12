import { maskValue } from "../masking.js";
const DEFAULT_PII_KEYS = [
    "email",
    "customer",
    "contact",
    "phone",
    "identifier",
    "account",
    "reporter",
    "subject",
    "citizen",
    "tax",
];
const EMAIL_REGEX = /.+@.+\..+/;
const DIGIT_SEQUENCE = /\d{4,}/;
export function maskPIIString(value) {
    if (!value) {
        return "***";
    }
    if (value.length <= 4) {
        return "***";
    }
    const start = value.slice(0, 2);
    const end = value.slice(-2);
    return `${start}${"*".repeat(Math.max(3, value.length - 4))}${end}`;
}
export function maskPIIValue(value, key, options) {
    if (value == null) {
        return value;
    }
    if (typeof value === "string") {
        if (shouldMaskPII(key, options) || EMAIL_REGEX.test(value) || DIGIT_SEQUENCE.test(value)) {
            return maskPIIString(value);
        }
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => maskPIIValue(item, key, options));
    }
    if (typeof value === "object") {
        return maskPIIObject(value, options);
    }
    return value;
}
export function maskPIIObject(input, options) {
    if (input == null) {
        return input;
    }
    if (Array.isArray(input)) {
        return input.map((value) => maskPIIValue(value, undefined, options));
    }
    if (typeof input !== "object") {
        return maskPIIValue(input, undefined, options);
    }
    const entries = Object.entries(input).map(([key, value]) => {
        if (shouldMaskPII(key, options)) {
            return [key, maskPIIValue(value, key, options)];
        }
        if (Array.isArray(value)) {
            return [key, value.map((item) => maskPIIValue(item, key, options))];
        }
        if (value && typeof value === "object") {
            return [key, maskPIIObject(value, options)];
        }
        return [key, maskValue(value, key)];
    });
    return Object.fromEntries(entries);
}
export function maskIncidentLike(record, options) {
    const additional = new Set(options?.additionalKeys ?? []);
    const merged = {
        additionalKeys: [...additional, "reporterEmail", "customerEmail", "customerName"],
    };
    return maskPIIObject(record, merged);
}
export function maskCollection(values, options) {
    return values.map((value) => maskPIIObject(value, options));
}
function shouldMaskPII(key, options) {
    if (!key) {
        return false;
    }
    const lower = key.toLowerCase();
    if (DEFAULT_PII_KEYS.some((candidate) => lower.includes(candidate))) {
        return true;
    }
    const additional = options?.additionalKeys ?? [];
    return additional.some((candidate) => lower.includes(candidate.toLowerCase()));
}
