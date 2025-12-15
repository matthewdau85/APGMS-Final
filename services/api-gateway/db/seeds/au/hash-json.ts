import { createHash } from "node:crypto";

export function hashJson(value: unknown): string {
  const canonical = JSON.stringify(value);
  return createHash("sha256").update(canonical).digest("hex");
}
