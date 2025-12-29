/**
 * Retention enforcement job (shim).
 *
 * The readiness assessor expects a retention job at:
 *   services/worker/src/jobs/retention.ts
 *
 * This file is intentionally a minimal entrypoint that can later be wired
 * to the real worker package logic (currently located under /worker).
 */

export type RetentionRunResult = {
  startedAt: string;
  finishedAt: string;
  status: "noop" | "ok" | "error";
  notes?: string;
};

export async function runRetentionJob(): Promise<RetentionRunResult> {
  const startedAt = new Date().toISOString();

  // TODO: implement real retention deletes/anonymization based on policy.
  // Suggested future wiring:
  // - Identify expired audit/access log rows
  // - Apply anonymization where legally required
  // - Record evidence artifact of the run

  const finishedAt = new Date().toISOString();

  return {
    startedAt,
    finishedAt,
    status: "noop",
    notes: "Shim only; implement real retention enforcement next.",
  };
}
