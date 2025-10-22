export interface BrownoutProtectorOptions {
  /**
   * Number of dependency failures that must occur inside the cooldown window before
   * the protector begins to shed load.
   */
  failureThreshold?: number;
  /**
   * Duration of the window (in milliseconds) used to evaluate dependency failures.
   * Requests are shed while the most recent failure remains inside this window.
   */
  cooldownMs?: number;
  /**
   * HTTP methods that should be considered high-impact and therefore eligible for shedding.
   * Read-only verbs are allowed through even when the shed circuit is active.
   */
  shedMethods?: ReadonlySet<string>;
}

export interface BrownoutDecision {
  shed: boolean;
  dependency?: string;
  reason?: string;
  retryAfterSeconds?: number;
}

interface FailureRecord {
  name: string;
  at: number;
  error?: string;
}

const DEFAULT_FAILURE_THRESHOLD = 2;
const DEFAULT_COOLDOWN_MS = 60_000;
const DEFAULT_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function createBrownoutProtector(
  options: BrownoutProtectorOptions = {}
): {
  noteFailure: (dependency: string, error?: Error) => void;
  noteSuccess: (dependency: string) => void;
  recordStatuses: (statuses: Array<{ name: string; healthy: boolean; error?: string }>) => void;
  shouldShed: (input: { method: string }) => BrownoutDecision;
  snapshot: () => { active: boolean; dependency?: string; reason?: string; retryAfterSeconds?: number };
} {
  const failureThreshold = Math.max(options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD, 1);
  const cooldownMs = Math.max(options.cooldownMs ?? DEFAULT_COOLDOWN_MS, 1000);
  const shedMethods = options.shedMethods ?? DEFAULT_METHODS;

  const failureHistory = new Map<string, FailureRecord[]>();

  const prune = (dependency: string, now: number) => {
    const history = failureHistory.get(dependency);
    if (!history) {
      return;
    }
    const filtered = history.filter((record) => now - record.at <= cooldownMs);
    if (filtered.length > 0) {
      failureHistory.set(dependency, filtered);
    } else {
      failureHistory.delete(dependency);
    }
  };

  const noteFailure = (dependency: string, error?: Error) => {
    const now = Date.now();
    const entry: FailureRecord = { name: dependency, at: now };
    if (error) {
      entry.error = error.message;
    }
    const history = failureHistory.get(dependency) ?? [];
    history.push(entry);
    failureHistory.set(dependency, history);
    prune(dependency, now);
  };

  const noteSuccess = (dependency: string) => {
    // Successful checks clear out failure history so the circuit can recover immediately.
    failureHistory.delete(dependency);
  };

  const recordStatuses = (
    statuses: Array<{ name: string; healthy: boolean; error?: string }>
  ) => {
    for (const status of statuses) {
      if (status.healthy) {
        noteSuccess(status.name);
      } else {
        noteFailure(status.name, status.error ? new Error(status.error) : undefined);
      }
    }
  };

  const shouldShed = ({ method }: { method: string }): BrownoutDecision => {
    if (!shedMethods.has(method.toUpperCase())) {
      return { shed: false };
    }
    const now = Date.now();
    for (const [dependency, failures] of failureHistory.entries()) {
      prune(dependency, now);
      if (failures.length >= failureThreshold) {
        const mostRecent = failures[failures.length - 1];
        const retryAfter = Math.max(1, Math.ceil((cooldownMs - (now - mostRecent.at)) / 1000));
        return {
          shed: true,
          dependency,
          reason: mostRecent.error ?? "dependency_unhealthy",
          retryAfterSeconds: retryAfter,
        };
      }
    }
    return { shed: false };
  };

  const snapshot = () => {
    const now = Date.now();
    for (const [dependency, failures] of failureHistory.entries()) {
      prune(dependency, now);
      if (failures.length >= failureThreshold) {
        const mostRecent = failures[failures.length - 1];
        const retryAfter = Math.max(1, Math.ceil((cooldownMs - (now - mostRecent.at)) / 1000));
        return {
          active: true,
          dependency,
          reason: mostRecent.error ?? "dependency_unhealthy",
          retryAfterSeconds: retryAfter,
        };
      }
    }
    return { active: false };
  };

  return { noteFailure, noteSuccess, recordStatuses, shouldShed, snapshot };
}
