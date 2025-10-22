import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

type Attributes = Record<string, unknown>;

export enum SpanKind {
  INTERNAL = "INTERNAL",
  SERVER = "SERVER",
  CLIENT = "CLIENT",
}

export enum SpanStatusCode {
  OK = "OK",
  ERROR = "ERROR",
}

export const SemanticAttributes = {
  HTTP_METHOD: "http.method",
  HTTP_TARGET: "http.target",
  HTTP_SCHEME: "http.scheme",
  HTTP_USER_AGENT: "http.user_agent",
  NET_HOST_NAME: "net.host.name",
  HTTP_FLAVOR: "http.flavor",
  HTTP_ROUTE: "http.route",
  HTTP_STATUS_CODE: "http.status_code",
  DB_SYSTEM: "db.system",
  DB_OPERATION: "db.operation",
  DB_NAME: "db.name",
  ENDUSER_ID: "enduser.id",
};

export const SemanticResourceAttributes = {
  SERVICE_NAME: "service.name",
  SERVICE_NAMESPACE: "service.namespace",
  SERVICE_VERSION: "service.version",
};

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
}

interface SpanOptions {
  kind?: SpanKind;
  attributes?: Attributes;
}

interface TraceStore {
  span?: SpanImpl;
  spanContext?: SpanContext;
}

export interface SpanExporter {
  export(spans: ReadonlyArray<ReadableSpan>): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface ReadableSpan {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  kind: SpanKind;
  status: SpanStatus;
  attributes: Attributes;
  events: Array<{ time: number; name: string; attributes?: Attributes }>;
  startTime: number;
  endTime: number;
  resource: Attributes;
}

class SpanImpl {
  public readonly name: string;
  public readonly traceId: string;
  public readonly spanId: string;
  public readonly parentSpanId?: string;
  public readonly kind: SpanKind;
  private status: SpanStatus = { code: SpanStatusCode.OK };
  private attributes: Attributes;
  private events: Array<{ time: number; name: string; attributes?: Attributes }> = [];
  private startTime: number;
  private endTime: number | null = null;
  private readonly resource: Attributes;
  private readonly onEnd: (span: ReadableSpan) => void;
  private ended = false;

  constructor(
    name: string,
    options: SpanOptions,
    parent: SpanImpl | undefined,
    resource: Attributes,
    onEnd: (span: ReadableSpan) => void,
    inheritedContext?: SpanContext
  ) {
    this.name = name;
    this.kind = options.kind ?? SpanKind.INTERNAL;
    this.attributes = { ...(options.attributes ?? {}) };
    this.traceId = inheritedContext?.traceId ?? parent?.traceId ?? generateTraceId();
    this.spanId = generateSpanId();
    this.parentSpanId = parent?.spanId ?? inheritedContext?.spanId;
    this.startTime = Date.now();
    this.resource = resource;
    this.onEnd = onEnd;
  }

  setAttribute(key: string, value: unknown): void {
    this.attributes[key] = value;
  }

  setAttributes(attributes: Attributes): void {
    for (const [key, value] of Object.entries(attributes)) {
      this.setAttribute(key, value);
    }
  }

  recordException(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.events.push({
      time: Date.now(),
      name: "exception",
      attributes: {
        "exception.type": err.name,
        "exception.message": err.message,
        "exception.stacktrace": err.stack,
      },
    });
    this.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  }

  setStatus(status: SpanStatus): void {
    this.status = status;
  }

  end(): void {
    if (this.ended) {
      return;
    }
    this.endTime = Date.now();
    this.ended = true;
    this.onEnd(this.toReadable());
  }

  toReadable(): ReadableSpan {
    return {
      name: this.name,
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      kind: this.kind,
      status: this.status,
      attributes: { ...this.attributes },
      events: [...this.events],
      startTime: this.startTime,
      endTime: this.endTime ?? Date.now(),
      resource: this.resource,
    };
  }
}

class InMemorySpanExporterImpl implements SpanExporter {
  private spans: ReadableSpan[] = [];

  export(spans: ReadonlyArray<ReadableSpan>): Promise<void> {
    this.spans.push(...spans.map((span) => ({ ...span })));
    return Promise.resolve();
  }

  reset(): void {
    this.spans = [];
  }

  getFinishedSpans(): ReadableSpan[] {
    return [...this.spans];
  }
}

class ConsoleSpanExporter implements SpanExporter {
  async export(spans: ReadonlyArray<ReadableSpan>): Promise<void> {
    for (const span of spans) {
      // eslint-disable-next-line no-console
      console.info("otel.span", JSON.stringify(span));
    }
  }
}

class HttpSpanExporter implements SpanExporter {
  constructor(private readonly endpoint: string) {}

  async export(spans: ReadonlyArray<ReadableSpan>): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceSpans: spans }),
        keepalive: false,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("failed to export spans", error);
    }
  }
}

class SpanProcessor {
  constructor(private readonly exporter: SpanExporter) {}

  onEnd(span: ReadableSpan): void {
    void this.exporter.export([span]);
  }

  async shutdown(): Promise<void> {
    if (typeof this.exporter.shutdown === "function") {
      await this.exporter.shutdown();
    }
  }
}

class TelemetryState {
  private processor: SpanProcessor | null = null;
  private exporter: SpanExporter | null = null;
  private tracers = new Map<string, Tracer>();
  private resource: Attributes = {};

  init(exporter: SpanExporter, resource: Attributes): void {
    this.exporter = exporter;
    this.processor = new SpanProcessor(exporter);
    this.resource = resource;
    this.tracers.clear();
  }

  getTracer(name: string): Tracer {
    if (!this.processor) {
      throw new Error("Telemetry has not been initialised");
    }
    let tracer = this.tracers.get(name);
    if (!tracer) {
      tracer = new Tracer(this.processor, this.resource);
      this.tracers.set(name, tracer);
    }
    return tracer;
  }

  getExporter(): SpanExporter | null {
    return this.exporter;
  }

  async shutdown(): Promise<void> {
    if (this.processor) {
      await this.processor.shutdown();
    }
    this.processor = null;
    this.exporter = null;
    this.tracers.clear();
  }
}

class Tracer {
  constructor(private readonly processor: SpanProcessor, private readonly resource: Attributes) {}

  startSpan(name: string, options: SpanOptions = {}, ctx?: TraceContext): SpanImpl {
    const store = ctx ?? telemetryContext.active();
    const span = new SpanImpl(
      name,
      options,
      store.span,
      this.resource,
      (spanData) => this.processor.onEnd(spanData),
      store.spanContext
    );
    return span;
  }

  startActiveSpan<TReturn>(
    name: string,
    options: SpanOptions,
    ctx: TraceContext,
    fn: (span: SpanImpl) => Promise<TReturn> | TReturn
  ): Promise<TReturn> | TReturn;
  startActiveSpan<TReturn>(
    name: string,
    options: SpanOptions,
    fn: (span: SpanImpl) => Promise<TReturn> | TReturn
  ): Promise<TReturn> | TReturn;
  startActiveSpan<TReturn>(
    name: string,
    optionsOrFn: SpanOptions | ((span: SpanImpl) => Promise<TReturn> | TReturn),
    ctxOrFn?: TraceContext | ((span: SpanImpl) => Promise<TReturn> | TReturn),
    maybeFn?: (span: SpanImpl) => Promise<TReturn> | TReturn
  ): Promise<TReturn> | TReturn {
    let options: SpanOptions;
    let ctx: TraceContext;
    let fn: (span: SpanImpl) => Promise<TReturn> | TReturn;

    if (typeof optionsOrFn === "function") {
      options = {};
      ctx = telemetryContext.active();
      fn = optionsOrFn;
    } else {
      options = optionsOrFn ?? {};
      if (typeof ctxOrFn === "function" || ctxOrFn === undefined) {
        ctx = telemetryContext.active();
        fn = (ctxOrFn as ((span: SpanImpl) => Promise<TReturn> | TReturn)) ?? ((() => undefined) as any);
      } else {
        ctx = ctxOrFn;
        fn = maybeFn ?? ((() => undefined) as any);
      }
    }

    const span = this.startSpan(name, options, ctx);
    const spanContext = { traceId: span.traceId, spanId: span.spanId };
    return telemetryContext.with({ span, spanContext }, () => fn(span));
  }
}

class TelemetryContextManager {
  private readonly storage = new AsyncLocalStorage<TraceStore>();

  active(): TraceContext {
    return this.storage.getStore() ?? {};
  }

  with<T>(ctx: TraceContext, fn: () => T): T {
    return this.storage.run(ctx, fn);
  }
}

type TraceContext = TraceStore;

const telemetryState = new TelemetryState();
const telemetryContext = new TelemetryContextManager();
const DEFAULT_MANAGED_COLLECTOR_ENDPOINT = "https://telemetry.apgms.cloud/v1/traces";
let activeCollectorEndpoint: string | undefined;

export const context = {
  active(): TraceContext {
    return telemetryContext.active();
  },
  with<T>(ctx: TraceContext, fn: () => T): T {
    return telemetryContext.with(ctx, fn);
  },
};

export const trace = {
  getTracer(name: string): Tracer {
    return telemetryState.getTracer(name);
  },
  setSpan(ctx: TraceContext, span: SpanImpl): TraceContext {
    return { ...ctx, span, spanContext: { traceId: span.traceId, spanId: span.spanId } };
  },
};

export const propagation = {
  extract(ctx: TraceContext, carrier: Record<string, string | string[] | undefined>): TraceContext {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(carrier)) {
      if (typeof value === "string") {
        headers[key.toLowerCase()] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        headers[key.toLowerCase()] = value[0];
      }
    }

    const header = headers["traceparent"];
    if (!header) {
      return ctx;
    }
    const match = /^([\da-f]{32})-([\da-f]{16})-/.exec(header.trim());
    if (!match) {
      return ctx;
    }
    const [, traceId, spanId] = match;
    return { ...ctx, spanContext: { traceId, spanId } };
  },
};

export function initTelemetry(): void {
  const exporterType = (process.env.OTEL_TRACES_EXPORTER ?? "").toLowerCase();
  let exporter: SpanExporter;

  const otlpEndpoint =
    exporterType === "memory"
      ? undefined
      : process.env.OTEL_EXPORTER_OTLP_ENDPOINT || DEFAULT_MANAGED_COLLECTOR_ENDPOINT;

  if (exporterType === "memory") {
    exporter = new InMemorySpanExporterImpl();
    activeCollectorEndpoint = undefined;
  } else if (exporterType === "otlp" || otlpEndpoint) {
    const endpoint = otlpEndpoint ?? DEFAULT_MANAGED_COLLECTOR_ENDPOINT;
    if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = endpoint;
    }
    exporter = new HttpSpanExporter(endpoint);
    activeCollectorEndpoint = endpoint;
  } else {
    exporter = new ConsoleSpanExporter();
    activeCollectorEndpoint = undefined;
  }

  const resource: Attributes = {
    [SemanticResourceAttributes.SERVICE_NAME]: "api-gateway",
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: "apgms",
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? "unknown",
  };

  telemetryState.init(exporter, resource);
}

export function getActiveSpanExporter(): InMemorySpanExporterImpl | null {
  const exporter = telemetryState.getExporter();
  return exporter instanceof InMemorySpanExporterImpl ? exporter : null;
}

export function getActiveCollectorEndpoint(): string | undefined {
  return activeCollectorEndpoint;
}

export async function shutdownTelemetry(): Promise<void> {
  await telemetryState.shutdown();
}

export type InMemorySpanExporter = InMemorySpanExporterImpl;
export type TelemetrySpan = SpanImpl;
export type TelemetryTracer = Tracer;
export type TelemetryContext = TraceContext;

function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}
