import { createHash } from "node:crypto";

export function sha256(input: string | Buffer): string {
  const h = createHash("sha256");
  h.update(input);
  return h.digest("hex");
}
