export interface SloTrackerOptions {
  availabilityTarget: number; // ratio between 0-1
  latencyTargetMs: number;
  sampleSize?: number;
}

export interface SloSnapshot {
  availabilityTarget: number;
  latencyTargetSeconds: number;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  errorBudgetRemaining: number;
  latencyP95Seconds: number;
}

const DEFAULT_SAMPLE_SIZE = 1000;

export function createSloTracker(options: SloTrackerOptions) {
  const availabilityTarget = Math.min(Math.max(options.availabilityTarget, 0), 1);
  const latencyTargetSeconds = Math.max(options.latencyTargetMs, 1) / 1000;
  const sampleSize = Math.max(options.sampleSize ?? DEFAULT_SAMPLE_SIZE, 10);

  let totalRequests = 0;
  let totalErrors = 0;
  const durationSamples: number[] = [];

  const record = (statusCode: number, durationSeconds: number) => {
    totalRequests += 1;
    if (statusCode >= 500) {
      totalErrors += 1;
    }
    const boundedDuration = Math.max(0, durationSeconds);
    durationSamples.push(boundedDuration);
    if (durationSamples.length > sampleSize) {
      durationSamples.splice(0, durationSamples.length - sampleSize);
    }
  };

  const snapshot = (): SloSnapshot => {
    const requests = totalRequests;
    const errors = totalErrors;
    const errorRate = requests === 0 ? 0 : errors / requests;
    const errorBudget = Math.max(0, 1 - availabilityTarget);
    let errorBudgetRemaining = 1;
    if (errorBudget === 0) {
      errorBudgetRemaining = errorRate === 0 ? 1 : 0;
    } else {
      const consumed = Math.min(errorRate / errorBudget, 1);
      errorBudgetRemaining = Math.max(0, 1 - consumed);
    }

    let latencyP95Seconds = 0;
    if (durationSamples.length > 0) {
      const sorted = [...durationSamples].sort((a, b) => a - b);
      const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
      latencyP95Seconds = sorted[index];
    }

    return {
      availabilityTarget,
      latencyTargetSeconds,
      totalRequests: requests,
      totalErrors: errors,
      errorRate,
      errorBudgetRemaining,
      latencyP95Seconds,
    };
  };

  return { record, snapshot };
}
