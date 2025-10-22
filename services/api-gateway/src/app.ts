import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { Prisma, type Org, type User, type BankLine, type PrismaClient } from "@prisma/client";
import {
  context,
  propagation,
  trace,
  SpanKind,
  SpanStatusCode,
  SemanticAttributes,
  initTelemetry,
  type TelemetryContext,
  type TelemetrySpan,
  type TelemetryTracer,
  getActiveCollectorEndpoint,
} from "./telemetry";

import { maskError, maskObject, maskEmail, verifyPassword } from "@apgms/shared";
import { registerAdminDataRoutes, type AdminPrincipal } from "./routes/admin.data";
import { createBrownoutProtector } from "./load-shed";
import { createSloTracker } from "./slo";
import type { JwtPluginOptions } from "./stubs/fastify-jwt";
import type { AuthTokenPayload } from "./types/auth";
type RegisterJwtStub = typeof import("./stubs/fastify-jwt").registerJwtStub;

const TOKEN_EXPIRY_SECONDS = 15 * 60;

const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/** Zod body schema for creating a bank line */
const CreateLine = z.object({
  date: z.string().datetime(), // ISO 8601 string
  amount: z.string().regex(/^-?\d+(\.\d+)?$/), // decimal as string
  payee: z.string().min(1),
  desc: z.string().min(1),
  orgId: z.string().min(1).optional(),
});

const UsersQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

const BankLinesQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export interface CreateAppOptions {
  prisma?: PrismaClient;
  dependencyChecks?: DependencyCheck[];
  httpClient?: HttpClient;
  tcpDialer?: TcpDialer;
}

export interface AdminOrgExport {
  org: {
    id: string;
    name: string;
    createdAt: string;
    deletedAt: string | null;
  };
  users: Array<{
    id: string;
    email: string;
    createdAt: string;
  }>;
  bankLines: Array<{
    id: string;
    date: string;
    amount: number;
    payee: string;
    desc: string;
    createdAt: string;
  }>;
}

type ExportableOrg = Org & { users: User[]; lines: BankLine[] };

type PrismaLike = {
  org: any;
  user: any;
  bankLine: any;
  orgTombstone: any;
  adminAuditLog?: any;
  $transaction: <T>(fn: (tx: PrismaLike) => Promise<T>) => Promise<T>;
  $queryRaw: (...args: any[]) => Promise<unknown>;
  $disconnect?: () => Promise<void>;
};

type MetricsLabels = {
  method: string;
  route: string;
  status_code: string;
};

type DependencyStatus = {
  name: string;
  healthy: boolean;
  error?: string;
};

type DependencyCheck = {
  name: string;
  check: (request: FastifyRequest | undefined) => Promise<void> | void;
};

type HttpClient = (
  input: string | URL,
  init?: RequestInit
) => Promise<{ ok: boolean; status: number }>;

type TcpDialer = (host: string, port: number, timeoutMs: number) => Promise<void>;

const TRACER_NAME = "apgms-api-gateway";
const DB_SYSTEM = "postgresql";

type DbSpanRunner = <T>(
  request: FastifyRequest | undefined,
  model: string | undefined,
  operation: string,
  fn: () => Promise<T>
) => Promise<T>;

function parseDatabaseName(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\//, "");
    return pathname.length > 0 ? pathname : undefined;
  } catch {
    return undefined;
  }
}

function coerceHeaderValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    return coerceHeaderValue(value[0]);
  }
  return undefined;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatLabels(labels: MetricsLabels): string {
  const entries = Object.entries(labels).map(
    ([key, value]) => `${key}="${escapeLabelValue(String(value))}"`
  );
  return `{${entries.join(",")}}`;
}

let cachedPrisma: PrismaLike | null = null;

async function loadDefaultPrisma(): Promise<PrismaLike> {
  if (!cachedPrisma) {
    const module = (await import("@apgms/shared/db")) as unknown as { prisma: PrismaLike };
    cachedPrisma = module.prisma;
  }
  return cachedPrisma;
}

type JwtPluginLoadResult =
  | { source: "real"; plugin: any }
  | { source: "stub"; registerStub: RegisterJwtStub };

async function loadJwtPlugin(): Promise<JwtPluginLoadResult> {
  try {
    const mod = await import("@fastify/jwt");
    return { plugin: (mod as any).default ?? mod, source: "real" };
  } catch (error) {
    const mod = await import("./stubs/fastify-jwt");
    return { source: "stub", registerStub: mod.registerJwtStub };
  }
}

function registerSecurityHeaders(app: FastifyInstance): void {
  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'self'",
  ];

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Content-Security-Policy", cspDirectives.join("; "));
    reply.header("Cross-Origin-Embedder-Policy", "require-corp");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (reply.hasHeader("X-Powered-By")) {
      reply.removeHeader("X-Powered-By");
    }
    return payload;
  });
}

async function runDependencyChecks(
  request: FastifyRequest | undefined,
  checks: DependencyCheck[]
): Promise<DependencyStatus[]> {
  const results: DependencyStatus[] = [];
  for (const check of checks) {
    try {
      await check.check(request);
      results.push({ name: check.name, healthy: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ name: check.name, healthy: false, error: message });
    }
  }
  return results;
}

async function ensureHttpHealthy(
  client: HttpClient,
  url: string,
  timeoutMs: number
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof (timer as any).unref === "function") {
    (timer as any).unref();
  }

  try {
    const response = await client(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "user-agent": "apgms-readiness" },
    });
    if (!response.ok) {
      throw new Error(`upstream_status_${response.status}`);
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    clearTimeout(timer);
  }
}

function parseTcpUrl(raw: string, fallbackPort: number): { host: string; port: number } {
  try {
    const url = new URL(raw);
    const protocol = url.protocol.toLowerCase();
    const explicitPort = url.port ? Number(url.port) : undefined;
    const port =
      explicitPort ??
      (protocol === "redis:" ? 6379 : protocol === "amqps:" ? 5671 : protocol === "amqp:" ? 5672 : fallbackPort);
    return { host: url.hostname, port };
  } catch (error) {
    throw new Error(`invalid_url_${raw}`);
  }
}

const defaultTcpDialer: TcpDialer = (host, port, timeoutMs) =>
  new Promise<void>((resolve, reject) => {
    let settled = false;
    const socket = createConnection({ host, port });

    const finalize = (err?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    socket.once("connect", () => finalize());
    socket.once("error", (err) => finalize(err instanceof Error ? err : new Error(String(err))));
    socket.setTimeout(timeoutMs, () => finalize(new Error(`timeout_after_${timeoutMs}ms`)));
  });

function deriveCollectorHealthUrl(
  explicitUrl: string | undefined,
  collectorEndpoint: string | undefined
): string | undefined {
  if (explicitUrl) {
    return explicitUrl;
  }
  const normalizedEndpoint = collectorEndpoint?.trim();
  if (!normalizedEndpoint) {
    return undefined;
  }
  try {
    const url = new URL(normalizedEndpoint);
    return `${url.origin}/health`;
  } catch {
    return undefined;
  }
}

function createDbSpanRunner(
  tracer: TelemetryTracer,
  databaseName: string | undefined,
  brownout?: ReturnType<typeof createBrownoutProtector>
): DbSpanRunner {
  return async function runDbSpan<T>(
    request: FastifyRequest | undefined,
    model: string | undefined,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const parentContext = request?.otelContext ?? context.active();
    const spanName = model ? `prisma.${model}.${operation}` : `prisma.${operation}`;
    const attributes: Record<string, unknown> = {
      [SemanticAttributes.DB_SYSTEM]: DB_SYSTEM,
      [SemanticAttributes.DB_OPERATION]: operation,
      "db.prisma.model": model ?? "raw",
    };
    if (databaseName) {
      attributes[SemanticAttributes.DB_NAME] = databaseName;
    }
    if (request?.user?.id) {
      attributes[SemanticAttributes.ENDUSER_ID] = request.user.id;
    }
    if (request?.correlationId) {
      attributes["http.request_id"] = request.correlationId;
    }

    return tracer.startActiveSpan(
      spanName,
      { attributes, kind: SpanKind.CLIENT },
      parentContext,
      async (span) => {
        try {
          const result = await fn();
          brownout?.noteSuccess("database");
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          const error = err instanceof Error ? err : new Error(String(err));
          brownout?.noteFailure("database", error);
          throw err;
        } finally {
          span.end();
        }
      }
    );
  };
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const prisma = (options.prisma as PrismaLike | undefined) ?? (await loadDefaultPrisma());

  initTelemetry();
  const tracer = trace.getTracer(TRACER_NAME);
  const databaseName = parseDatabaseName(process.env.DATABASE_URL);
  const collectorEndpoint = getActiveCollectorEndpoint();

  const app = Fastify({
    logger: true,
    genReqId: (req) =>
      coerceHeaderValue(req.headers["x-request-id"] ?? req.headers["x-correlation-id"]) ?? randomUUID(),
  });
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const allowedOrigins = parseCorsAllowList(process.env.CORS_ALLOWLIST);
  const adminAllowList = parseAdminAllowList(process.env.ADMIN_EMAIL_ALLOWLIST);
  const brownoutProtector = createBrownoutProtector();
  const sloTracker = createSloTracker({ availabilityTarget: 0.995, latencyTargetMs: 500 });
  const runDbSpan = createDbSpanRunner(tracer, databaseName, brownoutProtector);

  const requestTotals = new Map<string, number>();
  const requestDurations = new Map<string, { sum: number; count: number }>();

  const recordRequestMetrics = (
    labels: MetricsLabels,
    durationSeconds: number,
    statusCode: number
  ) => {
    const labelKey = formatLabels(labels);
    requestTotals.set(labelKey, (requestTotals.get(labelKey) ?? 0) + 1);
    const existing = requestDurations.get(labelKey) ?? { sum: 0, count: 0 };
    existing.sum += durationSeconds;
    existing.count += 1;
    requestDurations.set(labelKey, existing);
    sloTracker.record(statusCode, durationSeconds);
  };

  const buildMetricsPayload = () => {
    const lines: string[] = [];
    const memory = process.memoryUsage();
    lines.push("# HELP process_uptime_seconds Service uptime in seconds");
    lines.push("# TYPE process_uptime_seconds gauge");
    lines.push(`process_uptime_seconds ${process.uptime()}`);
    lines.push("# HELP process_resident_memory_bytes Resident set size in bytes");
    lines.push("# TYPE process_resident_memory_bytes gauge");
    lines.push(`process_resident_memory_bytes ${memory.rss}`);
    lines.push("# HELP api_http_requests_total Total number of HTTP requests");
    lines.push("# TYPE api_http_requests_total counter");
    for (const [labelKey, total] of requestTotals.entries()) {
      lines.push(`api_http_requests_total${labelKey} ${total}`);
    }
    lines.push("# HELP api_http_request_duration_seconds HTTP request duration in seconds");
    lines.push("# TYPE api_http_request_duration_seconds summary");
    for (const [labelKey, stats] of requestDurations.entries()) {
      lines.push(`api_http_request_duration_seconds_sum${labelKey} ${stats.sum.toFixed(6)}`);
      lines.push(`api_http_request_duration_seconds_count${labelKey} ${stats.count}`);
    }
    const slo = sloTracker.snapshot();
    lines.push("# HELP api_slo_availability_target Target availability ratio");
    lines.push("# TYPE api_slo_availability_target gauge");
    lines.push(`api_slo_availability_target ${slo.availabilityTarget}`);
    lines.push("# HELP api_slo_error_rate Observed error rate (5xx/total)");
    lines.push("# TYPE api_slo_error_rate gauge");
    lines.push(`api_slo_error_rate ${slo.errorRate.toFixed(6)}`);
    lines.push("# HELP api_slo_error_budget_remaining Remaining availability error budget (ratio 0-1)");
    lines.push("# TYPE api_slo_error_budget_remaining gauge");
    lines.push(`api_slo_error_budget_remaining ${slo.errorBudgetRemaining.toFixed(6)}`);
    lines.push("# HELP api_slo_latency_target_seconds Target p95 latency in seconds");
    lines.push("# TYPE api_slo_latency_target_seconds gauge");
    lines.push(`api_slo_latency_target_seconds ${slo.latencyTargetSeconds}`);
    lines.push("# HELP api_slo_latency_p95_seconds Observed p95 latency in seconds");
    lines.push("# TYPE api_slo_latency_p95_seconds gauge");
    lines.push(`api_slo_latency_p95_seconds ${slo.latencyP95Seconds.toFixed(6)}`);
    const loadShed = brownoutProtector.snapshot();
    lines.push("# HELP api_load_shedding_active Indicates whether load shedding is currently active (1=yes)");
    lines.push("# TYPE api_load_shedding_active gauge");
    lines.push(`api_load_shedding_active ${loadShed.active ? 1 : 0}`);
    if (loadShed.active) {
      lines.push("# HELP api_load_shedding_retry_after_seconds Suggested retry window while shedding is active");
      lines.push("# TYPE api_load_shedding_retry_after_seconds gauge");
      lines.push(`api_load_shedding_retry_after_seconds ${loadShed.retryAfterSeconds ?? 0}`);
    }
    return `${lines.join("\n")}\n`;
  };
  app.register(cors, {
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOrigins.size === 0) {
        cb(null, false);
        return;
      }
      if (allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
  });
  registerSecurityHeaders(app);
  const jwtModule = await loadJwtPlugin();
  const jwtOptions: JwtPluginOptions = {
    secret: jwtSecret,
    sign: { issuer: "apgms-api", expiresIn: TOKEN_EXPIRY_SECONDS },
    verify: { issuer: "apgms-api" },
  };
  if (jwtModule.source === "real") {
    app.register(jwtModule.plugin, jwtOptions);
  } else {
    app.log.warn("@fastify/jwt unavailable; falling back to in-process stub for tests");
    await jwtModule.registerStub(app, jwtOptions);
  }

  app.addHook("onRequest", async (request, reply) => {
    request.metricsStartTime = process.hrtime.bigint();
    request.correlationId = request.id;
    reply.header("x-request-id", request.correlationId);
    if (typeof request.log.child === "function") {
      request.log = request.log.child({ correlationId: request.correlationId });
    }

    const extracted = propagation.extract(context.active(), request.headers as Record<string, string>);
    const span = tracer.startSpan(
      "http.server",
      {
        kind: SpanKind.SERVER,
        attributes: {
          [SemanticAttributes.HTTP_METHOD]: request.method,
          [SemanticAttributes.HTTP_TARGET]: request.url,
          [SemanticAttributes.HTTP_SCHEME]: request.protocol ?? "http",
          [SemanticAttributes.HTTP_USER_AGENT]: coerceHeaderValue(request.headers["user-agent"]) ?? undefined,
          [SemanticAttributes.NET_HOST_NAME]: request.hostname ?? "localhost",
          [SemanticAttributes.HTTP_FLAVOR]: request.raw.httpVersion,
          "http.request_id": request.correlationId,
        },
      },
      extracted
    );
    request.otelSpan = span;
    request.otelContext = trace.setSpan(extracted, span);

    const shedDecision = brownoutProtector.shouldShed({ method: request.method });
    if (shedDecision.shed) {
      request.log.warn(
        {
          dependency: shedDecision.dependency,
          reason: shedDecision.reason,
        },
        "load_shedding_active"
      );
      if (shedDecision.retryAfterSeconds) {
        reply.header("Retry-After", String(shedDecision.retryAfterSeconds));
      }
      reply.header("Cache-Control", "no-store");
      return reply.code(503).send({
        error: "load_shedding",
        dependency: shedDecision.dependency,
        reason: shedDecision.reason,
      });
    }
  });

  app.addHook("preHandler", async (request) => {
    if (!request.otelSpan) {
      return;
    }
    const route =
      (request as FastifyRequest & { routerPath?: string }).routerPath ??
      ((request as FastifyRequest & { context?: { config?: { url?: string } } }).context?.config?.url ??
        request.url);
    request.otelSpan.setAttribute(SemanticAttributes.HTTP_ROUTE, route);
  });

  app.addHook("onError", async (request, _reply, error) => {
    const span = request.otelSpan;
    if (span) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    const span = request.otelSpan;
    if (span) {
      span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, reply.statusCode);
      if (reply.statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      } else if (reply.statusCode >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `client_error_${reply.statusCode}` });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      span.end();
      request.otelSpan = undefined;
    }

    const route =
      (reply.context as { config?: { url?: string } } | undefined)?.config?.url ??
      (request as FastifyRequest & { routerPath?: string }).routerPath ??
      request.url;
    const statusCode = reply.statusCode.toString();
    const labels: MetricsLabels = { method: request.method, route, status_code: statusCode };
    const start = request.metricsStartTime ?? process.hrtime.bigint();
    const diff = process.hrtime.bigint() - start;
    const durationSeconds = Math.max(Number(diff) / 1_000_000_000, 0);
    recordRequestMetrics(labels, durationSeconds, reply.statusCode);
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify();
      const audience = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
      if (!payload.orgId || !payload.sub) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      if (audience && audience !== payload.orgId) {
        return reply.code(403).send({ error: "forbidden" });
      }
    } catch (err) {
      request.log.warn({ err: maskError(err) }, "authentication_failed");
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  // Readiness: pings the DB
  const httpClient = options.httpClient ?? fetch;
  const tcpDialer = options.tcpDialer ?? defaultTcpDialer;

  const readinessChecks: DependencyCheck[] = [
    {
      name: "database",
      check: async (request) => {
        await runDbSpan(request, undefined, "$queryRaw", () => prisma.$queryRaw`SELECT 1`);
      },
    },
  ];

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    readinessChecks.push({
      name: "redis",
      check: async () => {
        const target = parseTcpUrl(redisUrl, 6379);
        await tcpDialer(target.host, target.port, 2000);
      },
    });
  }

  const collectorHealthUrl = deriveCollectorHealthUrl(
    process.env.OTEL_COLLECTOR_HEALTHCHECK_URL?.trim(),
    collectorEndpoint
  );
  if (collectorHealthUrl) {
    readinessChecks.push({
      name: "otel_collector",
      check: async () => {
        await ensureHttpHealthy(httpClient, collectorHealthUrl, 2000);
      },
    });
  }

  if (Array.isArray(options.dependencyChecks)) {
    readinessChecks.push(...options.dependencyChecks);
  }

  app.get("/ready", async (req, reply) => {
    const statuses = await runDependencyChecks(req, readinessChecks);
    brownoutProtector.recordStatuses(statuses);
    const healthy = statuses.every((status) => status.healthy);
    const code = healthy ? 200 : 503;
    return reply.code(code).send({ ready: healthy, dependencies: statuses });
  });

  app.get("/metrics", async (_req, reply) => {
    const body = buildMetricsPayload();
    reply.header("Content-Type", "text/plain; version=0.0.4");
    reply.header("Cache-Control", "no-cache");
    return reply.send(body);
  });

  app.addHook("onClose", async () => {
    requestTotals.clear();
    requestDurations.clear();
    const candidate = prisma as { $disconnect?: () => Promise<void> };
    if (typeof candidate.$disconnect === "function") {
      await candidate.$disconnect();
    }
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = LoginRequest.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const user = (await runDbSpan(req, "user", "findUnique", () =>
      prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, password: true, orgId: true, org: { select: { deletedAt: true } } },
      })
    )) as
      | ({
          id: string;
          email: string;
          password: string | null;
          orgId: string;
          org?: { deletedAt: Date | null } | null;
        })
      | null;

    if (!user?.password) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    if (user.org?.deletedAt) {
      return reply.code(403).send({ error: "account_disabled" });
    }

    const validPassword = await verifyPassword(password, user.password);
    if (!validPassword) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const role: AuthTokenPayload["role"] = adminAllowList.has(user.email.toLowerCase())
      ? "admin"
      : "user";

    const token = await reply.jwtSign(
      { id: user.id, sub: user.id, orgId: user.orgId, email: user.email, role },
      { audience: user.orgId }
    );

    return reply.code(200).send({ token, tokenType: "Bearer", expiresIn: TOKEN_EXPIRY_SECONDS });
  });

  app.get("/users", { onRequest: [app.authenticate] }, async (req, reply) => {
    const auth = req.user;
    const parsed = UsersQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_query", details: parsed.error.flatten() });
    }
    const users = (await runDbSpan(req, "user", "findMany", () =>
      prisma.user.findMany({
        where: { orgId: auth.orgId },
        select: { id: true, email: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: parsed.data.take,
      })
    )) as Array<{ id: string; email: string; createdAt: Date }>;
    return {
      users: users.map((user) => ({
        id: user.id,
        email: maskEmail(user.email),
        createdAt: user.createdAt.toISOString(),
      })),
    };
  });

  app.get("/bank-lines", { onRequest: [app.authenticate] }, async (req, reply) => {
    const auth = req.user;
    const parsed = BankLinesQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_query", details: parsed.error.flatten() });
    }
    const take = parsed.data.take ?? 20;
    const lines = (await runDbSpan(req, "bankLine", "findMany", () =>
      prisma.bankLine.findMany({
        where: { orgId: auth.orgId },
        orderBy: { date: "desc" },
        take,
      })
    )) as Array<{
      id: string;
      date: Date | string;
      amount: number | string;
      payee: string;
      desc: string;
      createdAt: Date | string;
    }>;
    return {
      lines: lines.map((line) => ({
        id: line.id,
        orgId: auth.orgId,
        date: line.date instanceof Date ? line.date.toISOString() : new Date(line.date).toISOString(),
        amount: normaliseAmount(line.amount),
        payee: line.payee,
        desc: line.desc,
        createdAt:
          line.createdAt instanceof Date
            ? line.createdAt.toISOString()
            : new Date(line.createdAt).toISOString(),
      })),
    };
  });

  // --- Validated + idempotent create ---
  app.post("/bank-lines", { onRequest: [app.authenticate] }, async (req, reply) => {
    const auth = req.user;
    const parsed = CreateLine.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const { date, amount, payee, desc, orgId } = parsed.data;
    if (orgId && orgId !== auth.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const actorOrgId = auth.orgId;
    const keyHeader = (req.headers["idempotency-key"] as string | undefined)?.trim();
    const idemKey = keyHeader && keyHeader.length > 0 ? keyHeader : undefined;

    try {
      if (idemKey) {
        // Upsert on the compound unique key @@unique([orgId, idempotencyKey])
        const line = await runDbSpan(req, "bankLine", "upsert", () =>
          prisma.bankLine.upsert({
            where: { orgId_idempotencyKey: { orgId: actorOrgId, idempotencyKey: idemKey } },
            create: {
              orgId: actorOrgId,
              date: new Date(date),
              amount,
              payee,
              desc,
              idempotencyKey: idemKey,
            },
            update: {}, // replay → no-op
            select: {
              id: true,
              orgId: true,
              date: true,
              amount: true,
              payee: true,
              desc: true,
              createdAt: true,
              idempotencyKey: true,
            },
          })
        );

        reply.header("Idempotency-Status", "reused");
        return reply.code(200).send(line);
      }

      // No idempotency key → plain create
      const created = await runDbSpan(req, "bankLine", "create", () =>
        prisma.bankLine.create({
          data: {
            orgId: actorOrgId,
            date: new Date(date),
            amount,
            payee,
            desc,
          },
          select: {
            id: true,
            orgId: true,
            date: true,
            amount: true,
            payee: true,
            desc: true,
            createdAt: true,
            idempotencyKey: true,
          },
        })
      );

      return reply.code(201).send(created);
    } catch (e) {
      // If a race slipped through, surface an idempotency-ish signal
      req.log.error({ err: maskError(e) }, "failed to create bank line");
      return reply.code(400).send({ error: "bad_request" });
    }
  });
  // --- /validated + idempotent create ---

  await registerAdminDataRoutes(app, {
    prisma,
    auth: {
      verify: (request) => verifyAdminPrincipal(request, adminAllowList),
    },
    dbSpan: runDbSpan,
  });

  app.get("/admin/export/:orgId", async (req, rep) => {
    const principal = await requireAdmin(req, rep, adminAllowList);
    if (!principal) {
      return;
    }
    const { orgId } = req.params as { orgId: string };
    if (principal.orgId !== orgId) {
      return rep.code(403).send({ error: "forbidden" });
    }
    const org = (await runDbSpan(req, "org", "findUnique", () =>
      prisma.org.findUnique({
        where: { id: orgId },
        include: { users: true, lines: true },
      })
    )) as (ExportableOrg & { deletedAt: Date | null }) | null;
    if (!org) {
      return rep.code(404).send({ error: "org_not_found" });
    }

    const exportPayload = buildOrgExport(org as ExportableOrg);
    return rep.send({ export: exportPayload });
  });

  app.delete("/admin/delete/:orgId", async (req, rep) => {
    const principal = await requireAdmin(req, rep, adminAllowList);
    if (!principal) {
      return;
    }
    const { orgId } = req.params as { orgId: string };
    if (principal.orgId !== orgId) {
      return rep.code(403).send({ error: "forbidden" });
    }
    const org = (await runDbSpan(req, "org", "findUnique", () =>
      prisma.org.findUnique({
        where: { id: orgId },
        include: { users: true, lines: true },
      })
    )) as (ExportableOrg & { deletedAt: Date | null }) | null;
    if (!org) {
      return rep.code(404).send({ error: "org_not_found" });
    }
    if (org.deletedAt) {
      return rep.code(409).send({ error: "already_deleted" });
    }

    const exportPayload = buildOrgExport(org as ExportableOrg);
    const deletedAt = new Date();
    const tombstonePayload: AdminOrgExport = {
      ...exportPayload,
      org: { ...exportPayload.org, deletedAt: deletedAt.toISOString() },
    };

    await runDbSpan(req, undefined, "$transaction", () =>
      prisma.$transaction(async (tx) => {
        await runDbSpan(req, "org", "update", () =>
          tx.org.update({
            where: { id: orgId },
            data: { deletedAt },
          })
        );
        await runDbSpan(req, "user", "deleteMany", () => tx.user.deleteMany({ where: { orgId } }));
        await runDbSpan(req, "bankLine", "deleteMany", () => tx.bankLine.deleteMany({ where: { orgId } }));
        await runDbSpan(req, "orgTombstone", "create", () =>
          tx.orgTombstone.create({
            data: {
              orgId,
              payload: tombstonePayload,
            },
          })
        );
      })
    );

    return rep.send({ status: "deleted", deletedAt: deletedAt.toISOString() });
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

async function requireAdmin(
  req: FastifyRequest,
  rep: FastifyReply,
  adminAllowList: Set<string>
): Promise<AdminPrincipal | null> {
  try {
    const principal = await verifyAdminPrincipal(req, adminAllowList);
    if (!principal) {
      const hasAuthHeader = typeof req.headers.authorization === "string";
      await rep.code(hasAuthHeader ? 403 : 401).send({ error: hasAuthHeader ? "forbidden" : "unauthorized" });
      return null;
    }
    return principal;
  } catch (err) {
    req.log.warn({ err: maskError(err) }, "admin_route_auth_failed");
    await rep.code(401).send({ error: "unauthorized" });
    return null;
  }
}

async function verifyAdminPrincipal(
  request: FastifyRequest,
  adminAllowList: Set<string>
): Promise<AdminPrincipal | null> {
  const payload = await request.jwtVerify();
  const audience = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  if (!payload.sub || !payload.orgId) {
    return null;
  }
  if (audience && audience !== payload.orgId) {
    return null;
  }
  if (payload.role !== "admin") {
    return null;
  }
  if (!adminAllowList.has(payload.email.toLowerCase())) {
    return null;
  }

  return {
    id: payload.sub,
    role: "admin",
    orgId: payload.orgId,
    email: payload.email,
  };
}

function buildOrgExport(org: ExportableOrg): AdminOrgExport {
  return {
    org: {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      deletedAt: org.deletedAt ? org.deletedAt.toISOString() : null,
    },
    users: org.users.map((user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    })),
    bankLines: org.lines.map((line) => ({
      id: line.id,
      date: line.date.toISOString(),
      amount: normaliseAmount(line.amount),
      payee: line.payee,
      desc: line.desc,
      createdAt: line.createdAt.toISOString(),
    })),
  };
}

function normaliseAmount(amount: unknown): number {
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") {
    const parsed = Number(amount);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (amount && typeof (amount as any).toNumber === "function") {
    try {
      return (amount as any).toNumber();
    } catch {
      return 0;
    }
  }
  return 0;
}

function parseAdminAllowList(env?: string): Set<string> {
  if (!env) {
    return new Set();
  }

  return new Set(
    env
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
  );
}

function parseCorsAllowList(env?: string): Set<string> {
  if (!env) {
    return new Set<string>();
  }
  return new Set(
    env
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  );
}
