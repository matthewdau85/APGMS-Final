export interface MetricOptions<T extends string = string> {
  name: string;
  help?: string;
  labelNames?: readonly T[];
  registers?: Registry[];
  buckets?: number[];
}

export class Counter<T extends string = string> {
  constructor(options: MetricOptions<T>);
  inc(labels?: Partial<Record<T, string>> | number, value?: number): void;
  serialize(): string;
}

export class Histogram<T extends string = string> {
  constructor(options: MetricOptions<T>);
  observe(labels: Partial<Record<T, string>>, value: number): void;
  serialize(): string;
}

export class Registry {
  readonly contentType: string;
  registerMetric(metric: { serialize(): string }): void;
  metrics(): Promise<string>;
}

export function collectDefaultMetrics(options?: { register?: Registry }): void;

export const register: Registry;
