// services/api-gateway/src/lib/setup-state.ts
import { readState } from "../state/dev-state.js";

export function isSetupComplete(): boolean {
  const s = readState();
  return Boolean(s.setup.setupComplete);
}

export function isTrainingAddonEnabled(): boolean {
  const s = readState();
  return Boolean(s.orgSettings.addons.clearComplianceTraining);
}
