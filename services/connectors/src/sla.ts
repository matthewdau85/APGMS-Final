export type SlaMetrics = {
  count: number;
  breaches: number;
  p95: number | null;
  p99: number | null;
};

export class SlaTracker {
  private readonly samples: number[] = [];
  private breachCount = 0;

  constructor(
    private readonly targetMs: number,
    private readonly maxSamples: number = 200,
  ) {}

  public record(durationMs: number): { breached: boolean; durationMs: number } {
    const breached = durationMs > this.targetMs;
    if (breached) {
      this.breachCount += 1;
    }

    this.samples.push(durationMs);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    return { breached, durationMs };
  }

  public metrics(): SlaMetrics {
    if (this.samples.length === 0) {
      return { count: 0, breaches: this.breachCount, p95: null, p99: null };
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const p95Index = Math.floor(0.95 * (sorted.length - 1));
    const p99Index = Math.floor(0.99 * (sorted.length - 1));

    return {
      count: this.samples.length,
      breaches: this.breachCount,
      p95: sorted[p95Index] ?? null,
      p99: sorted[p99Index] ?? null,
    };
  }
}
