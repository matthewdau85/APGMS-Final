import { redactLogPayload, redactError } from "./redaction.js";

export function safeLogAttributes<T>(payload: T): T {
  return redactLogPayload(payload) as T;
}

export function safeLogError(err: unknown): Record<string, unknown> {
  return redactError(err);
}
