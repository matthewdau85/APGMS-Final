import { setTimeout as sleep } from "node:timers/promises";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryableStatusCodes?: ReadonlySet<number>;
  onRetry?: (attempt: number, error: unknown) => void | Promise<void>;
}

const defaultRetryableStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function retry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 200,
    maxDelayMs = 5_000,
    backoffFactor = 2,
    retryableStatusCodes = defaultRetryableStatusCodes,
    onRetry,
  } = options;

  let attempt = 0;
  let delay = baseDelayMs;

  while (true) {
    attempt += 1;
    try {
      return await operation();
    } catch (error: unknown) {
      const status = (error as any)?.status as number | undefined;
      const retryable =
        attempt < maxAttempts &&
        (status === undefined || retryableStatusCodes.has(status));

      if (!retryable) {
        throw error;
      }

      if (onRetry) {
        await onRetry(attempt, error);
      }

      await sleep(Math.min(delay, maxDelayMs));
      delay *= backoffFactor;
    }
  }
}
