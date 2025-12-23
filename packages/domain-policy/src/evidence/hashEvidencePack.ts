import { createHash } from "node:crypto";
import type { EvidencePack } from "./evidence-pack.js";

export function hashEvidencePack(pack: EvidencePack): string {
  const json = JSON.stringify(pack, Object.keys(pack as object).sort());
  return createHash("sha256").update(json, "utf8").digest("hex");
}
