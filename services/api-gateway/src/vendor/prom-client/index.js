const DEFAULT_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

class MetricBase {
  constructor(options, type) {
    this.name = options.name;
    this.help = options.help ?? "";
    this.labelNames = Array.isArray(options.labelNames) ? [...options.labelNames] : [];
    this.type = type;
    this.registers = Array.isArray(options.registers) ? options.registers : [];
    for (const registry of this.registers) {
      if (registry && typeof registry.registerMetric === "function") {
        registry.registerMetric(this);
      }
    }
  }

  formatHeader() {
    return [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} ${this.type}`];
  }

  formatLabels(labels) {
    if (!this.labelNames.length) {
      return "";
    }
    const entries = this.labelNames.map((label) => {
      const value = labels[label] ?? "";
      return `${label}="${String(value).replace(/"/g, '\\"')}"`;
    });
    return `{${entries.join(",")}}`;
  }
}

export class Counter extends MetricBase {
  constructor(options) {
    super(options, "counter");
    this.values = new Map();
  }

  inc(labelsOrValue = 1, value) {
    let labels = {};
    let amount = 1;
    if (typeof labelsOrValue === "number") {
      amount = labelsOrValue;
    } else {
      labels = labelsOrValue ?? {};
      amount = typeof value === "number" ? value : 1;
    }
    if (!Number.isFinite(amount)) {
      amount = 0;
    }
    const key = this.labelNames
      .map((label) => `${label}:${labels[label] ?? ""}`)
      .join("|");
    const current = this.values.get(key) ?? { labels, value: 0 };
    current.value += amount;
    this.values.set(key, current);
  }

  serialize() {
    const lines = this.formatHeader();
    for (const { labels, value } of this.values.values()) {
      lines.push(`${this.name}${this.formatLabels(labels)} ${value}`);
    }
    return lines.join("\n");
  }
}

export class Histogram extends MetricBase {
  constructor(options) {
    super(options, "histogram");
    const providedBuckets = Array.isArray(options.buckets) ? options.buckets.slice() : [];
    this.buckets = providedBuckets.length ? providedBuckets.sort((a, b) => a - b) : [0.1, 1, 5];
    this.values = new Map();
  }

  observe(labels = {}, value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return;
    }
    const key = this.labelNames
      .map((label) => `${label}:${labels[label] ?? ""}`)
      .join("|");
    if (!this.values.has(key)) {
      this.values.set(key, {
        labels,
        count: 0,
        sum: 0,
        buckets: this.buckets.map(() => 0),
      });
    }
    const entry = this.values.get(key);
    entry.count += 1;
    entry.sum += numeric;
    for (let i = 0; i < this.buckets.length; i += 1) {
      if (numeric <= this.buckets[i]) {
        entry.buckets[i] += 1;
      }
    }
  }

  serialize() {
    const lines = this.formatHeader();
    for (const { labels, count, sum, buckets } of this.values.values()) {
      for (let i = 0; i < this.buckets.length; i += 1) {
        const le = this.buckets[i];
        const bucketLabels = { ...labels, le: Number.isFinite(le) ? le : "+Inf" };
        lines.push(`${this.name}_bucket${this.formatLabels(bucketLabels)} ${buckets[i]}`);
      }
      const infLabels = { ...labels, le: "+Inf" };
      lines.push(`${this.name}_bucket${this.formatLabels(infLabels)} ${count}`);
      lines.push(`${this.name}_sum${this.formatLabels(labels)} ${sum}`);
      lines.push(`${this.name}_count${this.formatLabels(labels)} ${count}`);
    }
    return lines.join("\n");
  }
}

export class Registry {
  constructor() {
    this.contentType = DEFAULT_CONTENT_TYPE;
    this._metrics = new Set();
  }

  registerMetric(metric) {
    this._metrics.add(metric);
  }

  async metrics() {
    const serialized = [];
    for (const metric of this._metrics) {
      if (metric && typeof metric.serialize === "function") {
        serialized.push(metric.serialize());
      }
    }
    return serialized.join("\n\n");
  }
}

export function collectDefaultMetrics() {
  // no-op in this minimal implementation
}

export const register = new Registry();
