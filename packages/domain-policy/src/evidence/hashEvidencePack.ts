import crypto from "crypto";
import { EvidencePack } from "./evidence-pack";

export function hashEvidencePack(pack: EvidencePack): string {
  const stable = JSON.stringify(pack, Object.keys(pack).sort());
  return crypto.createHash("sha256").update(stable).digest("hex");
}
