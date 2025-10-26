import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import {
  Span,
  SpanStatusCode,
  trace,
  type Attributes,
} from "@opentelemetry/api";
import { z } from "zod";
import {
  PrismaClient,
  type Org,
  type User,
  type BankLine,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { maskError, maskObject } from "@apgms/shared";
import {
  configurePIIProviders,
  decryptPII,
  encryptPII,
} from "./lib/pii";
import {
  authenticateRequest,
  hashIdentifier,
  type Principal,
  type Role,
} from "./lib/auth";
import {
  createAuditLogger,
  createKeyManagementService,
  createSaltProvider,
} from "./security/providers";
import metricsPlugin from "./plugins/metrics";
import { loadConfig, type AppConfig } from "./config";

export interface CreateAppOptions {
  prisma?: PrismaClient;
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
type PrismaLike = any;

let cachedPrisma: PrismaClient | null = null;
const tracer = trace.getTracer("apgms-api-gateway");

const ANOMALY_WINDOW_MS = 60_000;
const DEFAULT_AUTH_FAILURE_THRESHOLD = 5;
const anomalyCounters = new Map<
  string,
  { count: number; expiresAt: number }
>();

async function loadDefaultPrisma(): Promise<PrismaLike> {
  if (!cachedPrisma) {
    const module = (await import("@apgms/shared/db")) as {
      prisma: PrismaClient;
    };
    cachedPrisma = module.prisma;
  }
  return cachedPrisma as PrismaLike;
}

const CreateLine = z
  .object({
    date: z.string().datetime(),
    amount: z.string().regex(/^-?\d+(\.\d+)?$/),
    payee: z.string().min(1),
    desc: z.string().min(1),
  })
  .strict();

const ListLinesQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).default(20),
});

type AllowedRole = Role;

/**
 * Require RBAC on a route. Returns the Principal or null if blocked & already replied.
 */
async function requirePrincipal(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
  roles: ReadonlyArray<AllowedRole>
): Promise<Principal | null> {
  const principal = await authenticateRequest(app, req, reply, roles);
  if (!principal) {
    return null;
  }
  return principal;
}

/**
 * Unified error payload with anomaly tracking + metrics hooks.
 */
function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): void {
  const payload = {
    error: { code, message, ...(details ? { details } : {}) },
  };

  const serverWithMetrics = reply.server as FastifyInstance & {
    metrics?: { recordSecurityEvent: (event: string) => void };
  };
  const serverWithConfig = reply.server as FastifyInstance & {
    config?: AppConfig & {
      security?: { authFailureThreshold?: number };
    };
  };
  const anomalyThreshold =
    serverWithConfig.config?.security?.authFailureThreshold ??
    DEFAULT_AUTH_FAILURE_THRESHOLD;

  const request = reply.request as FastifyRequest & {
    traceSpan?: Span | null;
  };

  // track repeated auth failures as "anomaly"
  if (code === "unauthorized" || code === "forbidden") {
    const now = Date.now();
    const requestWithRoute = request as FastifyRequest & {
      routerPath?: string;
      routeOptions?: { url?: string };
    };
    const route =
      requestWithRoute.routerPath ??
      requestWithRoute.routeOptions?.url ??
      request.url ??
      "unknown";

    const key = `${request.ip}:${route}`;
    const existing = anomalyCounters.get(key);

    if (!existing || existing.expiresAt < now) {
      anomalyCounters.set(key, {
        count: 1,
        expiresAt: now + ANOMALY_WINDOW_MS,
      });
    } else {
      existing.count += 1;
      if (existing.count >= anomalyThreshold) {
        reply.server.log.warn(
          { key, count: existing.count },
          "detected repeated authorization failures"
        );
        serverWithMetrics.metrics?.recordSecurityEvent("anomaly.auth");
        // reset window
        existing.count = 0;
        existing.expiresAt = now + ANOMALY_WINDOW_MS;
      }
    }
  }

  serverWithMetrics.metrics?.recordSecurityEvent(`error.${code}`);
  request.traceSpan?.addEvent(`error.${code}`, { statusCode });

  void reply.code(statusCode).send(payload);
}

/**
 * Redact emails before returning them
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) {
    return "***";
  }
  if (local.length <= 2) {
    const head = local.slice(0, 1) || "*";
    return `${head}*@${domain}`;
  }
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function sanitiseUser(
  orgId: string,
  user: { id: string; email: string; createdAt: Date }
) {
  return {
    userId: hashIdentifier(`${orgId}:${user.id}`),
    email: maskEmail(user.email),
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Best-effort decrypt of a PII field; never throw plaintext errors outward.
 */
function decryptField(ciphertext: string, kid: string): string {
  try {
    return decryptPII({ ciphertext, kid });
  } catch {
    return "***";
  }
}

function sanitiseBankLine(line: {
  id: string;
  date: Date;
  amount: unknown;
  descCiphertext: string;
  descKid: string;
  createdAt: Date;
}) {
  const description = decryptField(line.descCiphertext, line.descKid);
  return {
    id: hashIdentifier(line.id),
    postedAt: line.date.toISOString(),
    amount: normaliseAmount(line.amount),
    description,
    createdAt: line.createdAt.toISOString(),
  };
}

export async function createApp(
  options: CreateAppOptions = {}
): Promise<FastifyInstance> {
  //
  // 1. Central config
  //
  const config = loadConfig();

  const isProd = process.env.NODE_ENV === "production";

  // HARD GATE: refuse to boot if CORS allowlist is empty (always)
  if (
    !config.cors?.allowedOrigins ||
    config.cors.allowedOrigins.length === 0
  ) {
    throw new Error(
      "CORS_ALLOWED_ORIGINS is not configured. Refusing to start."
    );
  }

  // HARD GATE (prod only): KMS keyset must be loaded
  if (isProd && !config.security?.kmsKeysetLoaded) {
    throw new Error("KMS keys not loaded. Refusing to start.");
  }

  //
  // 2. Prisma handle (cached if not injected)
  //
  const prisma =
    (options.prisma as PrismaLike | undefined) ??
    (await loadDefaultPrisma());

  //
  // 3. Security / crypto providers
  //
  const kms = await createKeyManagementService();
  const saltProvider = await createSaltProvider();
  const auditLogger = createAuditLogger(prisma as PrismaClient);
  configurePIIProviders({ kms, saltProvider, auditLogger });

  //
  // 4. Fastify instance
  //
  const app = Fastify({ logger: true });

  // expose config + prisma on the instance so server.ts / readiness can poke health
  app.decorate("config", config);
  (app as any).prisma = prisma;

  //
  // 5. Tracing: span per request
  //
  app.decorateRequest("traceSpan", null);

  app.addHook("onRequest", (req, reply, done) => {
    const span = tracer.startSpan(`http ${req.method} ${req.url}`);
    req.traceSpan = span;

    reply.header("x-request-id", req.id);
    req.log = req.log.child({ requestId: req.id });

    done();
  });

  // close span, attach status code
  app.addHook("onResponse", (req, reply, doneCb) => {
    req.traceSpan?.setAttribute("http.status_code", reply.statusCode);
    req.traceSpan?.end();
    req.traceSpan = null;
    doneCb();
  });

  // capture unexpected errors for telemetry + metrics
  app.addHook("onError", (req, _reply, error, doneCb) => {
    req.traceSpan?.recordException(error as Error);
    req.traceSpan?.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    app.metrics?.recordSecurityEvent("http.error");
    doneCb();
  });

  //
  // 6. Metrics (/metrics endpoint, recordSecurityEvent hook, etc.)
  //
  await app.register(metricsPlugin);

  //
  // 7. Global rate limiter
  //
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });

  //
  // 8. Security headers (helmet)
  //
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        "frame-ancestors": ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hidePoweredBy: true,
    strictTransportSecurity: {
      includeSubDomains: true,
      preload: true,
    },
  });

  //
  // 9. CORS allowlist from config
  //
  const allowedOrigins = config.cors.allowedOrigins;

  await app.register(cors, {
    origin: (origin, cb) => {
      // allow same-origin / server-to-server calls (no Origin header)
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }

      app.metrics?.recordSecurityEvent("cors.reject");
      app.log.warn(
        { origin },
        "blocked CORS request - origin not permitted"
      );
      cb(new Error("Origin not allowed"), false);
    },
    credentials: true,
  });

  //
  // 10. Helper for audit trail writes (also emits tracing + metrics)
  //
  const recordAudit = async (
    req: FastifyRequest,
    reply: FastifyReply,
    principal: Principal,
    action: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> =>
    tracer.startActiveSpan(`audit.${action}`, async (span) => {
      span.setAttributes({
        "audit.org_id": principal.orgId,
        "audit.actor_id": principal.id,
      });

      try {
        await auditLogger.record({
          actorId: principal.id,
          action,
          timestamp: new Date().toISOString(),
          metadata: { orgId: principal.orgId, ...metadata },
        });

        req.traceSpan?.addEvent(action, toSpanAttributes(metadata));
        app.metrics?.recordSecurityEvent(action);

        span.setStatus({ code: SpanStatusCode.OK });
        return true;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });

        req.log.error({ err: maskError(error) }, "audit_failed");
        app.metrics?.recordSecurityEvent("audit_failed");

        sendError(
          reply,
          500,
          "audit_failed",
          "Unable to record audit trail"
        );
        return false;
      } finally {
        span.end();
      }
    });

  //
  // 11. Startup log (redacted env context)
  //
  app.log.info(
    maskObject({
      DATABASE_URL: config.databaseUrl,
      SHADOW_DATABASE_URL: config.shadowDatabaseUrl ?? null,
    }),
    "loaded env"
  );

  //
  // 12. Liveness
  // (Readiness with draining is handled in server.ts, not here.)
  //
  app.get("/health", async () => ({
    ok: true,
    service: "api-gateway",
  }));

  //
  // 13. Authenticated routes
  //

  // List org users (RBAC = admin)
  app.get(
    "/users",
    {
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, ["admin"]);
      if (!principal) return;

      const users = (await prisma.user.findMany({
        where: { orgId: principal.orgId },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })) as Array<{
        id: string;
        email: string;
        createdAt: Date;
      }>;

      const payload = {
        users: users.map((user) => sanitiseUser(principal.orgId, user)),
      };

      if (
        !(await recordAudit(req, reply, principal, "users.list", {
          count: payload.users.length,
        }))
      ) {
        return;
      }

      return reply.send(payload);
    }
  );

  // List bank lines (RBAC = admin/analyst/finance)
  app.get(
    "/bank-lines",
    {
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, [
        "admin",
        "analyst",
        "finance",
      ]);
      if (!principal) return;

      const parsedQuery = ListLinesQuery.safeParse(req.query ?? {});
      if (!parsedQuery.success) {
        sendError(
          reply,
          400,
          "invalid_query",
          "Invalid query parameters",
          parsedQuery.error.flatten()
        );
        return;
      }

      const { take } = parsedQuery.data;

      const lines = (await prisma.bankLine.findMany({
        where: { orgId: principal.orgId },
        orderBy: { date: "desc" },
        take,
        select: {
          id: true,
          date: true,
          amount: true,
          descCiphertext: true,
          descKid: true,
          createdAt: true,
        },
      })) as Array<{
        id: string;
        date: Date;
        amount: unknown;
        descCiphertext: string;
        descKid: string;
        createdAt: Date;
      }>;

      const payload = {
        lines: lines.map(sanitiseBankLine),
      };

      if (
        !(await recordAudit(req, reply, principal, "bank-lines.list", {
          count: payload.lines.length,
        }))
      ) {
        return;
      }

      return reply.send(payload);
    }
  );

  // Create bank line (RBAC = admin), supports idempotency-key
  app.post(
    "/bank-lines",
    {
      config: {
        rateLimit: { max: 20, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, ["admin"]);
      if (!principal) return;

      const parsed = CreateLine.safeParse(req.body ?? {});
      if (!parsed.success) {
        sendError(
          reply,
          400,
          "invalid_body",
          "Invalid request body",
          parsed.error.flatten()
        );
        return;
      }

      const { date, amount, payee, desc } = parsed.data;

      // optional replay-protection
      const keyHeader = (
        req.headers["idempotency-key"] as string | undefined
      )?.trim();
      const idemKey =
        keyHeader && keyHeader.length > 0 ? keyHeader : undefined;

      // encrypt PII before saving
      const encryptedPayee = encryptPII(payee);
      const encryptedDesc = encryptPII(desc);

      try {
        if (idemKey) {
          // upsert on (orgId, idempotencyKey)
          const line = await prisma.bankLine.upsert({
            where: {
              orgId_idempotencyKey: {
                orgId: principal.orgId,
                idempotencyKey: idemKey,
              },
            },
            create: {
              orgId: principal.orgId,
              date: new Date(date),
              amount: new Decimal(amount),
              payeeCiphertext: encryptedPayee.ciphertext,
              payeeKid: encryptedPayee.kid,
              descCiphertext: encryptedDesc.ciphertext,
              descKid: encryptedDesc.kid,
              idempotencyKey: idemKey,
            },
            update: {},
            select: {
              id: true,
              date: true,
              amount: true,
              descCiphertext: true,
              descKid: true,
              createdAt: true,
            },
          });

          const sanitized = sanitiseBankLine(line);

          reply.header("Idempotency-Status", "reused");

          if (
            !(await recordAudit(req, reply, principal, "bank-lines.create", {
              reused: true,
              id: sanitized.id,
            }))
          ) {
            return;
          }

          return reply.code(200).send({ line: sanitized });
        }

        // normal create
        const created = await prisma.bankLine.create({
          data: {
            orgId: principal.orgId,
            date: new Date(date),
            amount: new Decimal(amount),
            payeeCiphertext: encryptedPayee.ciphertext,
            payeeKid: encryptedPayee.kid,
            descCiphertext: encryptedDesc.ciphertext,
            descKid: encryptedDesc.kid,
          },
          select: {
            id: true,
            date: true,
            amount: true,
            descCiphertext: true,
            descKid: true,
            createdAt: true,
          },
        });

        const sanitized = sanitiseBankLine(created);

        if (
          !(await recordAudit(req, reply, principal, "bank-lines.create", {
            reused: false,
            id: sanitized.id,
          }))
        ) {
          return;
        }

        return reply.code(201).send({ line: sanitized });
      } catch (error) {
        req.log.error(
          { err: maskError(error) },
          "failed to create bank line"
        );
        sendError(
          reply,
          400,
          "bad_request",
          "Unable to create bank line"
        );
      }
    }
  );

  // Export org snapshot (RBAC = admin)
  app.get(
    "/admin/export/:orgId",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, ["admin"]);
      if (!principal) return;

      const { orgId } = req.params as { orgId: string };

      if (principal.orgId !== orgId) {
        sendError(
          reply,
          403,
          "forbidden",
          "Cannot export another organisation"
        );
        return;
      }

      const org = await prisma.org.findUnique({
        where: { id: orgId },
        include: { users: true, lines: true },
      });
      if (!org) {
        sendError(
          reply,
          404,
          "org_not_found",
          "Organisation not found"
        );
        return;
      }

      const exportPayload = buildOrgExport(org as ExportableOrg);

      if (
        !(await recordAudit(req, reply, principal, "admin.org.export", {
          orgId,
        }))
      ) {
        return;
      }

      return reply.send({ export: exportPayload });
    }
  );

  // Delete org with tombstone preservation (RBAC = admin)
  app.delete(
    "/admin/delete/:orgId",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, ["admin"]);
      if (!principal) return;

      const { orgId } = req.params as { orgId: string };

      if (principal.orgId !== orgId) {
        sendError(
          reply,
          403,
          "forbidden",
          "Cannot delete another organisation"
        );
        return;
      }

      const org = await prisma.org.findUnique({
        where: { id: orgId },
        include: { users: true, lines: true },
      });
      if (!org) {
        sendError(
          reply,
          404,
          "org_not_found",
          "Organisation not found"
        );
        return;
      }

      if (org.deletedAt) {
        sendError(
          reply,
          409,
          "already_deleted",
          "Organisation already deleted"
        );
        return;
      }

      const exportPayload = buildOrgExport(org as ExportableOrg);

      const deletedAt = new Date();
      const tombstonePayload: AdminOrgExport = {
        ...exportPayload,
        org: {
          ...exportPayload.org,
          deletedAt: deletedAt.toISOString(),
        },
      };

      await prisma.$transaction(async (tx: typeof prisma) => {
        await tx.org.update({
          where: { id: orgId },
          data: { deletedAt },
        });

        await tx.user.deleteMany({ where: { orgId } });
        await tx.bankLine.deleteMany({ where: { orgId } });

        await tx.orgTombstone.create({
          data: {
            orgId,
            payload: tombstonePayload,
          },
        });
      });

      if (
        !(await recordAudit(req, reply, principal, "admin.org.delete", {
          orgId,
        }))
      ) {
        return;
      }

      return reply.send({
        status: "deleted",
        deletedAt: deletedAt.toISOString(),
      });
    }
  );

  //
  // route dump on ready (CI smoke/debug)
  //
  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

/**
 * Build an export snapshot for an org, including decrypted payee/desc and normalized amounts.
 */
function buildOrgExport(org: ExportableOrg): AdminOrgExport {
  return {
    org: {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      deletedAt: org.deletedAt ? org.deletedAt.toISOString() : null,
    },
    users: org.users.map((user: User) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    })),
    bankLines: org.lines.map((line: BankLine) => ({
      id: line.id,
      date: line.date.toISOString(),
      amount: normaliseAmount(line.amount),
      payee: decryptField(
        (line as any).payeeCiphertext,
        (line as any).payeeKid
      ),
      desc: decryptField(
        (line as any).descCiphertext,
        (line as any).descKid
      ),
      createdAt: line.createdAt.toISOString(),
    })),
  };
}

/**
 * Convert Prisma Decimal | string | number into a number
 */
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

/**
 * Turn arbitrary metadata into span attributes for tracing
 */
function toSpanAttributes(
  input: Record<string, unknown>
): Attributes {
  const attributes: Attributes = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      attributes[key] = value;
      continue;
    }

    attributes[key] = JSON.stringify(value);
  }

  return attributes;
}

// Fastify module augmentation so we can hang config/prisma/metrics/traceSpan on instances/reqs
declare module "fastify" {
  interface FastifyRequest {
    traceSpan?: import("@opentelemetry/api").Span | null;
  }

  interface FastifyInstance {
    // prisma handle (we attach this in createApp so server.ts / readiness can poke the DB)
    prisma?: any;

    // central runtime config
    config: import("./config").AppConfig;

    // metrics helpers from metricsPlugin
    metrics?: {
      recordSecurityEvent: (event: string) => void;
      incAuthFailure: (orgId: string) => void;
      incCorsReject: (origin: string) => void;
    };
  }
}
