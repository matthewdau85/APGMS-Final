import os from "node:os";

export type Labels = Record<string, string | number>;

type MetricCollector = () => string | Promise<string>;

function formatLabelValue(value: string | number): string {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

export class Registry {
  private collectors: MetricCollector[] = [];

  registerMetric(collector: MetricCollector): void {
    this.collectors.push(collector);
  }

  async metrics(): Promise<string> {
    const parts = await Promise.all(this.collectors.map(async (collector) => collector()));
    return parts.filter(Boolean).join("\n\n");
  }

  get contentType(): string {
    return "text/plain; version=0.0.4; charset=utf-8";
  }
}

export const register = new Registry();

export interface HistogramConfiguration {
  name: string;
  help: string;
  labelNames?: string[];
  buckets?: number[];
  registers?: Registry[];
}

interface HistogramRecord {
  labels: Labels;
  buckets: number[];
  counts: number[];
  sum: number;
  observations: number;
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function createLabelKey(labelNames: string[], labels: Labels): string {
  return labelNames
    .map((name) => `${name}:${labels[name] ?? ""}`)
    .join("|");
}

function sanitizeLabels(labelNames: string[] | undefined, labels: Labels): Labels {
  if (!labelNames || labelNames.length === 0) {
    return {};
  }
  const sanitized: Labels = {};
  for (const name of labelNames) {
    const value = labels[name];
    sanitized[name] = value === undefined ? "" : value;
  }
  return sanitized;
}

export class Histogram {
  private readonly labelNames: string[];
  private readonly buckets: number[];
  private readonly records = new Map<string, HistogramRecord>();

  constructor(private readonly config: HistogramConfiguration) {
    this.labelNames = config.labelNames ?? [];
    this.buckets = [...(config.buckets ?? DEFAULT_BUCKETS)].sort((a, b) => a - b);

    const registries = config.registers && config.registers.length > 0 ? config.registers : [register];
    for (const reg of registries) {
      reg.registerMetric(() => this.serialize());
    }
  }

  observe(labels: Labels, value: number): void {
    const sanitized = sanitizeLabels(this.labelNames, labels);
    const key = createLabelKey(this.labelNames, sanitized);
    const existing = this.records.get(key);
    const record = existing ?? {
      labels: sanitized,
      buckets: this.buckets,
      counts: new Array(this.buckets.length).fill(0),
      sum: 0,
      observations: 0,
    };

    for (let index = 0; index < this.buckets.length; index += 1) {
      if (value <= this.buckets[index]) {
        record.counts[index] += 1;
      }
    }

    record.sum += value;
    record.observations += 1;

    this.records.set(key, record);
  }

  startTimer(baseLabels: Labels = {}): (labels?: Labels) => number {
    const start = process.hrtime.bigint();
    return (labels: Labels = {}) => {
      const end = process.hrtime.bigint();
      const durationSeconds = Number(end - start) / 1e9;
      this.observe({ ...baseLabels, ...labels }, durationSeconds);
      return durationSeconds;
    };
  }

  private serialize(): string {
    const lines: string[] = [];
    lines.push(`# HELP ${this.config.name} ${this.config.help}`);
    lines.push(`# TYPE ${this.config.name} histogram`);

    for (const record of this.records.values()) {
      for (let index = 0; index < record.buckets.length; index += 1) {
        const le = record.buckets[index];
        const labels = this.formatLabels({ ...record.labels, le });
        lines.push(`${this.config.name}_bucket${labels} ${record.counts[index]}`);
      }
      const labelsInf = this.formatLabels({ ...record.labels, le: "+Inf" });
      lines.push(`${this.config.name}_bucket${labelsInf} ${record.observations}`);
      lines.push(`${this.config.name}_sum${this.formatLabels(record.labels)} ${record.sum}`);
      lines.push(`${this.config.name}_count${this.formatLabels(record.labels)} ${record.observations}`);
    }

    return lines.join("\n");
  }

  private formatLabels(labels: Labels): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) {
      return "";
    }
    const rendered = entries
      .map(([key, value]) => `${key}="${formatLabelValue(value)}"`)
      .join(",");
    return `{${rendered}}`;
  }
}

export interface DefaultMetricsOptions {
  register?: Registry;
  prefix?: string;
}

export function collectDefaultMetrics(options: DefaultMetricsOptions = {}): void {
  const targetRegistry = options.register ?? register;
  const prefix = options.prefix ?? "";

  targetRegistry.registerMetric(() => {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    const load = os.loadavg();

    const metrics: string[] = [];

    metrics.push(`# HELP ${prefix}process_uptime_seconds Process uptime in seconds.`);
    metrics.push(`# TYPE ${prefix}process_uptime_seconds gauge`);
    metrics.push(`${prefix}process_uptime_seconds ${uptime}`);

    metrics.push(`# HELP ${prefix}process_heap_used_bytes Process heap used in bytes.`);
    metrics.push(`# TYPE ${prefix}process_heap_used_bytes gauge`);
    metrics.push(`${prefix}process_heap_used_bytes ${memory.heapUsed}`);

    metrics.push(`# HELP ${prefix}process_rss_bytes Resident set size in bytes.`);
    metrics.push(`# TYPE ${prefix}process_rss_bytes gauge`);
    metrics.push(`${prefix}process_rss_bytes ${memory.rss}`);

    metrics.push(`# HELP ${prefix}process_load_average Load average over 1m, 5m, 15m.`);
    metrics.push(`# TYPE ${prefix}process_load_average gauge`);
    metrics.push(`${prefix}process_load_average{window="1"} ${load[0] ?? 0}`);
    metrics.push(`${prefix}process_load_average{window="5"} ${load[1] ?? 0}`);
    metrics.push(`${prefix}process_load_average{window="15"} ${load[2] ?? 0}`);

    return metrics.join("\n");
  });
}
