// ClearCompliance Training Add-on: local feature-flag storage
// Kept intentionally lightweight for the prototype: no backend dependency.

const KEY = "apgms.addons.clearcomplianceTraining.enabled";
const EVENT = "apgms:addons:clearcompliance-training";

export function readClearComplianceTrainingEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return false;
    const v = JSON.parse(raw);
    return Boolean(v);
  } catch {
    return false;
  }
}

export function writeClearComplianceTrainingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(Boolean(enabled)));
  } catch {
    // ignore (private mode, quota, etc.)
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // ignore
  }
}

export function subscribeClearComplianceTrainingEnabled(onChange: (enabled: boolean) => void): () => void {
  const handler = () => onChange(readClearComplianceTrainingEnabled());

  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) handler();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, handler as EventListener);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, handler as EventListener);
  };
}
