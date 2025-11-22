export interface RetryOptions {
  readonly maxAttempts?: number;
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly jitter?: boolean;
  readonly retriable?: (error: unknown) => boolean;
}

/**
 * Generic async retry with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 250,
    maxDelayMs = 5_000,
    jitter = true,
    retriable = () => true,
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts || !retriable(error)) {
        throw error;
      }

      let sleepFor = delay;
      if (jitter) {
        const rand = 0.5 + Math.random(); // 0.5–1.5
        sleepFor = Math.floor(delay * rand);
      }

      await new Promise((resolve) => setTimeout(resolve, sleepFor));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}
