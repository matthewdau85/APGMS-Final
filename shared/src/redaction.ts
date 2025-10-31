import { maskValue, maskObject, maskError as maskErrorBase } from "./masking.js";

const REDACTED = "[REDACTED]";

const EMAIL_REGEX =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TFN_REGEX =
  /\b\d{3}\s?\d{3}\s?\d{3}\b/g;
const ABN_REGEX =
  /\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g;
const IBAN_REGEX =
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;

function redactIdentifiers(value: string): string {
  let redacted = value.replace(EMAIL_REGEX, "[REDACTED:EMAIL]");
  redacted = redacted.replace(ABN_REGEX, "[REDACTED:ABN]");
  redacted = redacted.replace(TFN_REGEX, "[REDACTED:TFN]");
  redacted = redacted.replace(IBAN_REGEX, "[REDACTED:IBAN]");
  return redacted;
}

function redactInternal(value: unknown, key?: string): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    const scrubbed = redactIdentifiers(value);
    return maskValue(scrubbed, key);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactInternal(entry, key));
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        redactInternal(v, k),
      ]),
    );
  }

  return maskValue(value, key);
}

export function redactValue<T>(input: T): T {
  return redactInternal(input) as T;
}

export function redactObject<T extends Record<string, unknown>>(input: T): T {
  return maskObject(redactInternal(input)) as T;
}

export function redactError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const base = {
      name: err.name,
      message: maskValue(redactIdentifiers(err.message ?? ""), "message"),
      stack: REDACTED,
    } as Record<string, unknown>;

    const possibleCause = (err as { cause?: unknown }).cause;
    if (possibleCause !== undefined) {
      base.cause = redactInternal(possibleCause);
    }

    return base;
  }

  const masked = maskErrorBase(err);
  return Object.fromEntries(
    Object.entries(masked).map(([k, v]) => [k, redactInternal(v, k)]),
  );
}

export function redactLogPayload(payload: unknown): unknown {
  return redactInternal(payload);
}
