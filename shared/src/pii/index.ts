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

export interface MaskingOptions {
  additionalKeys?: readonly string[];
}

const EMAIL_REGEX = /.+@.+\..+/;
const DIGIT_SEQUENCE = /\d{4,}/;

export function maskPIIString(value: string): string {
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

export function maskPIIValue(value: unknown, key?: string, options?: MaskingOptions): unknown {
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
    return maskPIIObject(value as Record<string, unknown>, options);
  }

  return value;
}

export function maskPIIObject<T>(input: T, options?: MaskingOptions): T {
  if (input == null) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((value) => maskPIIValue(value, undefined, options)) as unknown as T;
  }

  if (typeof input !== "object") {
    return maskPIIValue(input, undefined, options) as T;
  }

  const entries = Object.entries(input as Record<string, unknown>).map(([key, value]) => {
    if (shouldMaskPII(key, options)) {
      return [key, maskPIIValue(value, key, options)];
    }
    if (Array.isArray(value)) {
      return [key, value.map((item) => maskPIIValue(item, key, options))];
    }
    if (value && typeof value === "object") {
      return [key, maskPIIObject(value as Record<string, unknown>, options)];
    }
    return [key, maskValue(value, key)];
  });

  return Object.fromEntries(entries) as T;
}

export function maskIncidentLike<T extends Record<string, unknown>>(
  record: T,
  options?: MaskingOptions
): T {
  const additional = new Set(options?.additionalKeys ?? []);
  const merged: MaskingOptions = {
    additionalKeys: [...additional, "reporterEmail", "customerEmail", "customerName"],
  };
  return maskPIIObject(record, merged);
}

export function maskCollection<T>(values: readonly T[], options?: MaskingOptions): T[] {
  return values.map((value) => maskPIIObject(value, options));
}

function shouldMaskPII(key?: string, options?: MaskingOptions): boolean {
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
