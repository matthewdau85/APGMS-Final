import type { FastifyBaseLogger } from "fastify";
import { redactLogPayload, redactError } from "@apgms/shared";

type LogLevel = "debug" | "info" | "warn" | "error";

export function logEvent(
  logger: FastifyBaseLogger,
  level: LogLevel,
  message: string,
  payload?: Record<string, unknown>,
): void {
  const safePayload = payload ? (redactLogPayload(payload) as Record<string, unknown>) : undefined;
  logger[level](safePayload ?? {}, message);
}

export function logError(
  logger: FastifyBaseLogger,
  message: string,
  error: unknown,
  payload?: Record<string, unknown>,
): void {
  const safePayload = payload ? (redactLogPayload(payload) as Record<string, unknown>) : undefined;
  logger.error({ error: redactError(error), ...(safePayload ?? {}) }, message);
}
