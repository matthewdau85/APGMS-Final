export type LabelValues = Record<string, string>;

interface MetricOptions {
  name: string;
  help: string;
  labelNames?: string[];
  registers?: Registry[];
}

abstract class MetricBase {
  protected readonly labelNames: string[];
  constructor(
    protected readonly name: string,
    protected readonly help: string,
    opts: { labelNames?: string[]; registers?: Registry[] }
  ) {
    this.labelNames = opts.labelNames ?? [];
    for (const register of opts.registers ?? []) {
      register.registerMetric(this);
    }
  }

  abstract reset(): void;
  abstract snapshot(): string;
  protected formatLabels(labels: LabelValues): string {
    if (this.labelNames.length === 0) {
      return "";
    }
    const parts = this.labelNames.map((name) => {
      const value = labels[name] ?? "";
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
      return `${name}="${escaped}"`;
    });
    return `{${parts.join(",")}}`;
  }

  protected header(type: string): string {
    return `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} ${type}`;
  }
}

export class Counter extends MetricBase {
  private readonly values = new Map<string, { labels: LabelValues; value: number }>();

  constructor(opts: MetricOptions) {
    super(opts.name, opts.help, { labelNames: opts.labelNames, registers: opts.registers });
  }

  inc(labels: LabelValues = {}, value = 1): void {
    const key = this.createKey(labels);
    const entry = this.values.get(key);
    if (entry) {
      entry.value += value;
    } else {
      this.values.set(key, { labels: { ...labels }, value });
    }
  }

  reset(): void {
    this.values.clear();
  }

  snapshot(): string {
    const lines = [this.header("counter")];
    for (const { labels, value } of this.values.values()) {
      lines.push(`${this.name}${this.formatLabels(labels)} ${value}`);
    }
    return lines.join("\n");
  }

  private createKey(labels: LabelValues): string {
    return this.labelNames.map((label) => `${label}:${labels[label] ?? ""}`).join("|");
  }
}

interface HistogramOptions extends MetricOptions {
  buckets?: number[];
}

interface HistogramEntry {
  labels: LabelValues;
  bucketCounts: number[];
  count: number;
  sum: number;
}

export class Histogram extends MetricBase {
  private readonly buckets: number[];
  private readonly values = new Map<string, HistogramEntry>();

  constructor(opts: HistogramOptions) {
    super(opts.name, opts.help, { labelNames: opts.labelNames, registers: opts.registers });
    const provided = opts.buckets ?? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];
    this.buckets = [...provided].sort((a, b) => a - b);
  }

  observe(labels: LabelValues = {}, value: number): void {
    const key = this.createKey(labels);
    let entry = this.values.get(key);
    if (!entry) {
      entry = {
        labels: { ...labels },
        bucketCounts: new Array(this.buckets.length).fill(0),
        count: 0,
        sum: 0,
      };
      this.values.set(key, entry);
    }
    entry.count += 1;
    entry.sum += value;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        entry.bucketCounts[i] += 1;
      }
    }
  }

  reset(): void {
    this.values.clear();
  }

  snapshot(): string {
    const lines = [this.header("histogram")];
    for (const { labels, bucketCounts, count, sum } of this.values.values()) {
      for (let i = 0; i < this.buckets.length; i++) {
        const le = this.buckets[i];
        const leLabel = `${this.formatLabels({ ...labels, le: formatBucket(le) })}`;
        const cumulative = bucketCounts[i];
        lines.push(`${this.name}_bucket${leLabel} ${cumulative}`);
      }
      const infLabel = `${this.formatLabels({ ...labels, le: "+Inf" })}`;
      lines.push(`${this.name}_bucket${infLabel} ${count}`);
      lines.push(`${this.name}_sum${this.formatLabels(labels)} ${sum}`);
      lines.push(`${this.name}_count${this.formatLabels(labels)} ${count}`);
    }
    return lines.join("\n");
  }

  private createKey(labels: LabelValues): string {
    return this.labelNames.map((label) => `${label}:${labels[label] ?? ""}`).join("|");
  }
}

function formatBucket(value: number): string {
  if (Number.isFinite(value)) {
    return Number(value).toString();
  }
  return "+Inf";
}

export class Registry {
  private readonly entries = new Set<MetricBase>();
  readonly contentType = "text/plain; version=0.0.4; charset=utf-8";

  registerMetric(metric: MetricBase): void {
    this.entries.add(metric);
  }

  clear(): void {
    this.entries.clear();
  }

  resetMetrics(): void {
    for (const metric of this.entries) {
      metric.reset();
    }
  }

  async metrics(): Promise<string> {
    if (this.entries.size === 0) {
      return "";
    }
    const parts = [] as string[];
    for (const metric of this.entries) {
      parts.push(metric.snapshot());
    }
    return parts.join("\n\n") + "\n";
  }
}

export function collectDefaultMetrics(): void {
  // No-op in the lightweight implementation.
}
