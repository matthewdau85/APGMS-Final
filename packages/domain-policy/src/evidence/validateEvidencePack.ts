import type { EvidencePack } from "./evidence-pack.js";

export function validateEvidencePack(pack: EvidencePack): void {
  if (!pack.inputDataHash) {
    throw new Error("Evidence pack invalid: missing inputDataHash");
  }

  if (!pack.taxSpec?.id || !pack.taxSpec?.version) {
    throw new Error("Evidence pack invalid: missing taxSpec metadata");
  }

  if (!pack.computation?.timestamp) {
    throw new Error("Evidence pack invalid: missing computation timestamp");
  }

  if (!pack.outputs?.obligations) {
    throw new Error("Evidence pack invalid: missing output obligations");
  }

  if (!pack.ledger?.entries || !pack.ledger?.ledgerHash) {
    throw new Error("Evidence pack invalid: missing ledger entries or hash");
  }

  if (!pack.system?.gitSha) {
    throw new Error("Evidence pack invalid: missing system git SHA");
  }

  if (!pack.readiness?.status || !pack.readiness?.checkedAt) {
    throw new Error("Evidence pack invalid: missing readiness status");
  }
}
