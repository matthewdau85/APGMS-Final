// services/api-gateway/src/lib/retry.ts
// Simple retry helper with exponential backoff.

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 300,
): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
