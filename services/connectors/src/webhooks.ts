import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookSignatureOptions = {
  secret: string | Buffer;
  headerName?: string;
  algorithm?: "sha256" | "sha512";
};

export function verifyWebhookSignature(
  payload: string,
  headers: Record<string, string | string[] | undefined>,
  options: WebhookSignatureOptions,
): boolean {
  const headerName = options.headerName ?? "x-signature";
  const algorithm = options.algorithm ?? "sha256";
  const presented = headers[headerName];
  const presentedValue = Array.isArray(presented) ? presented[0] : presented;

  if (!presentedValue) {
    return false;
  }

  const hmac = createHmac(algorithm, options.secret);
  hmac.update(payload);
  const digest = hmac.digest("hex");

  try {
    return timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(presentedValue, "utf8"));
  } catch {
    return false;
  }
}
