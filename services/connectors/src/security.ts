import { createHmac, timingSafeEqual } from "node:crypto";

function normalizeSignature(signature: string): Buffer {
  const value = signature.includes("=")
    ? signature.slice(signature.indexOf("=") + 1)
    : signature;
  return Buffer.from(value.trim(), "hex");
}

export function verifyHmacSignature(
  payload: string,
  secret: string,
  providedSignature: string,
  algorithm: string = "sha256",
): boolean {
  const hmac = createHmac(algorithm, secret);
  hmac.update(payload, "utf8");
  const expected = hmac.digest();
  let actual: Buffer;

  try {
    actual = normalizeSignature(providedSignature);
  } catch {
    return false;
  }

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export class ReplayProtector {
  private readonly seen = new Map<string, number>();

  constructor(private readonly windowMs: number = 5 * 60 * 1000) {}

  public register(id: string, timestampMs: number = Date.now()): boolean {
    this.prune(timestampMs);

    if (this.seen.has(id)) {
      return false;
    }

    if (timestampMs < Date.now() - this.windowMs) {
      return false;
    }

    this.seen.set(id, timestampMs);
    return true;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    for (const [id, ts] of this.seen.entries()) {
      if (ts < cutoff) {
        this.seen.delete(id);
      }
    }
  }
}
