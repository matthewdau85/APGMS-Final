import { createHmac, timingSafeEqual } from "node:crypto";

export interface SignaturePayload {
  payload: string | Buffer;
  timestamp: string;
}

export interface SignatureOptions {
  secret: string;
  toleranceMs?: number;
}

export function createSignature(options: SignatureOptions, data: SignaturePayload): string {
  const mac = createHmac("sha256", options.secret);
  const body = typeof data.payload === "string" ? Buffer.from(data.payload, "utf8") : data.payload;
  mac.update(data.timestamp, "utf8");
  mac.update(".");
  mac.update(body);
  return mac.digest("hex");
}

export function verifySignature(
  options: SignatureOptions,
  data: SignaturePayload,
  providedSignature: string,
): boolean {
  const toleranceMs = options.toleranceMs ?? 5 * 60 * 1000;
  const timestampMs = Number.parseInt(data.timestamp, 10) * 1000;
  if (!Number.isFinite(timestampMs)) {
    return false;
  }

  const drift = Math.abs(Date.now() - timestampMs);
  if (drift > toleranceMs) {
    return false;
  }

  const expected = createSignature(options, data);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(providedSignature, "hex");
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, providedBuf);
}
