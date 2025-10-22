import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { z } from "zod";
import { Prisma, type Org, type User, type BankLine, type PrismaClient } from "@prisma/client";

import { maskError, maskObject } from "@apgms/shared";
import { configurePIIProviders, decryptPII, encryptPII } from "./lib/pii";
import { AuthError, hashIdentifier, requireRole, verifyRequest, type Principal } from "./lib/auth";
import { createAuditLogger, createKeyManagementService, createSaltProvider } from "./security/providers";
import metricsPlugin from "./plugins/metrics";

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

type PrismaLike = Pick<
  PrismaClient,
  "org" | "user" | "bankLine" | "orgTombstone" | "$transaction" | "$queryRaw"
>;

let cachedPrisma: PrismaClient | null = null;
const tracer = trace.getTracer("apgms-api-gateway");
const ANOMALY_WINDOW_MS = 60_000;
const ANOMALY_THRESHOLD = Number(process.env.AUTH_FAILURE_THRESHOLD ?? "5");
const anomalyCounters = new Map<string, { count: number; expiresAt: number }>();

async function loadDefaultPrisma(): Promise<PrismaLike> {
  if (!cachedPrisma) {
    const module = (await import("@apgms/shared/db")) as { prisma: PrismaClient };
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

const DEFAULT_RATE_LIMIT = Number(process.env.API_RATE_LIMIT_MAX ?? "60");
const DEFAULT_RATE_WINDOW = process.env.API_RATE_LIMIT_WINDOW ?? "1 minute";

type AllowedRole = Parameters<typeof requireRole>[1][number];

async function requirePrincipal(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
  roles: ReadonlyArray<AllowedRole>,
): Promise<Principal | null> {
  try {
    const principal = await verifyRequest(req, reply);
    requireRole(principal, roles);
    app.metrics?.recordSecurityEvent("auth.success");
    return principal;
  } catch (error) {
    if (error instanceof AuthError) {
      app.metrics?.recordSecurityEvent(`auth.${error.code}`);
      sendError(reply, error.statusCode, error.code, error.message);
      return null;
    }
    throw error;
  }
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const payload = { error: { code, message, ...(details ? { details } : {}) } };
  const serverWithMetrics = reply.server as FastifyInstance & {
    metrics?: { recordSecurityEvent: (event: string) => void };
  };
  const request = reply.request as FastifyRequest & { traceSpan?: Span | null };

  if (code === "unauthorized" || code === "forbidden") {
    const now = Date.now();
    const key = `${request.ip}:${request.routerPath ?? request.url ?? "unknown"}`;
    const existing = anomalyCounters.get(key);
    if (!existing || existing.expiresAt < now) {
      anomalyCounters.set(key, { count: 1, expiresAt: now + ANOMALY_WINDOW_MS });
    } else {
      existing.count += 1;
      if (existing.count >= ANOMALY_THRESHOLD) {
        reply.server.log.warn(
          { key, count: existing.count },
          "detected repeated authorization failures",
        );
        serverWithMetrics.metrics?.recordSecurityEvent("anomaly.auth");
        existing.count = 0;
        existing.expiresAt = now + ANOMALY_WINDOW_MS;
      }
    }
  }

  serverWithMetrics.metrics?.recordSecurityEvent(`error.${code}`);
  request.traceSpan?.addEvent(`error.${code}`, { statusCode });
  void reply.code(statusCode).send(payload);
}

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

function sanitiseUser(orgId: string, user: { id: string; email: string; createdAt: Date }) {
  return {
    userId: hashIdentifier(`${orgId}:${user.id}`),
    email: maskEmail(user.email),
    createdAt: user.createdAt.toISOString(),
  };
}

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

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const prisma = (options.prisma as PrismaLike | undefined) ?? (await loadDefaultPrisma());

  const kms = createKeyManagementService();
  const saltProvider = createSaltProvider();
  const auditLogger = createAuditLogger(prisma as PrismaClient);
  configurePIIProviders({ kms, saltProvider, auditLogger });

  const app = Fastify({ logger: true });

  app.decorateRequest("traceSpan", null);

  app.addHook("onRequest", (req, reply, done) => {
    const span = tracer.startSpan(`http ${req.method} ${req.url}`);
    req.traceSpan = span;
    reply.header("x-request-id", req.id);
    done();
  });

  app.addHook("onResponse", (req, reply, done) => {
    req.traceSpan?.setAttribute("http.status_code", reply.statusCode);
    req.traceSpan?.end();
    req.traceSpan = null;
    done();
  });
  await app.register(metricsPlugin);

  await app.register(rateLimit, {
    max: DEFAULT_RATE_LIMIT,
    timeWindow: DEFAULT_RATE_WINDOW,
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });

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

  app.register(cors, {
    origin: (origin, cb) => {
      const allowed = process.env.CORS_ALLOWED_ORIGINS;
      if (!allowed) {
        cb(null, true);
        return;
      }
      const allowedOrigins = allowed.split(",").map((item) => item.trim());
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error("Origin not allowed"), false);
    },
    credentials: true,
  });

  const recordAudit = async (
    req: FastifyRequest,
    reply: FastifyReply,
    principal: Principal,
    action: string,
    metadata: Record<string, unknown> = {},
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
        req.traceSpan?.addEvent(action, metadata);
        app.metrics?.recordSecurityEvent(action);
        span.setStatus({ code: SpanStatusCode.OK });
        return true;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        req.log.error({ err: maskError(error) }, "audit_failed");
        app.metrics?.recordSecurityEvent("audit_failed");
        sendError(reply, 500, "audit_failed", "Unable to record audit trail");
        return false;
      } finally {
        span.end();
      }
    });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/ready", async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      app.metrics?.recordSecurityEvent("readiness.ok");
      return reply.code(200).send({ ready: true });
    } catch (error) {
      app.log.warn({ err: maskError(error) }, "readiness check failed");
      app.metrics?.recordSecurityEvent("readiness.fail");
      return reply.code(503).send({ ready: false });
    }
  });

  app.get(
    "/users",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, ["admin"]);
      if (!principal) {
        return;
      }

      const users = await prisma.user.findMany({
        where: { orgId: principal.orgId },
        select: { id: true, email: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      const payload = {
        users: users.map((user) => sanitiseUser(principal.orgId, user)),
      };

      if (!(await recordAudit(req, reply, principal, "users.list", { count: payload.users.length }))) {
        return;
      }

      return reply.send(payload);
    },
  );

  app.get(
    "/bank-lines",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, ["admin", "analyst", "finance"]);
      if (!principal) {
        return;
      }

      const parsedQuery = ListLinesQuery.safeParse(req.query ?? {});
      if (!parsedQuery.success) {
        sendError(reply, 400, "invalid_query", "Invalid query parameters", parsedQuery.error.flatten());
        return;
      }

      const { take } = parsedQuery.data;
      const lines = await prisma.bankLine.findMany({
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
      });

      const payload = {
        lines: lines.map(sanitiseBankLine),
      };

      if (!(await recordAudit(req, reply, principal, "bank-lines.list", { count: payload.lines.length }))) {
        return;
      }

      return reply.send(payload);
    },
  );

  app.post(
    "/bank-lines",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, ["admin"]);
      if (!principal) {
        return;
      }

      const parsed = CreateLine.safeParse(req.body ?? {});
      if (!parsed.success) {
        sendError(reply, 400, "invalid_body", "Invalid request body", parsed.error.flatten());
        return;
      }

      const { date, amount, payee, desc } = parsed.data;
      const keyHeader = (req.headers["idempotency-key"] as string | undefined)?.trim();
      const idemKey = keyHeader && keyHeader.length > 0 ? keyHeader : undefined;

      const encryptedPayee = encryptPII(payee);
      const encryptedDesc = encryptPII(desc);

      try {
        if (idemKey) {
          const line = await prisma.bankLine.upsert({
            where: { orgId_idempotencyKey: { orgId: principal.orgId, idempotencyKey: idemKey } },
            create: {
              orgId: principal.orgId,
              date: new Date(date),
              amount: new Prisma.Decimal(amount),
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
          if (!(await recordAudit(req, reply, principal, "bank-lines.create", { reused: true, id: sanitized.id }))) {
            return;
          }
          return reply.code(200).send({ line: sanitized });
        }

        const created = await prisma.bankLine.create({
          data: {
            orgId: principal.orgId,
            date: new Date(date),
            amount: new Prisma.Decimal(amount),
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
        if (!(await recordAudit(req, reply, principal, "bank-lines.create", { reused: false, id: sanitized.id }))) {
          return;
        }
        return reply.code(201).send({ line: sanitized });
      } catch (error) {
        req.log.error({ err: maskError(error) }, "failed to create bank line");
        sendError(reply, 400, "bad_request", "Unable to create bank line");
      }
    },
  );

  app.get(
    "/admin/export/:orgId",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, ["admin"]);
      if (!principal) {
        return;
      }

      const { orgId } = req.params as { orgId: string };
      if (principal.orgId !== orgId) {
        sendError(reply, 403, "forbidden", "Cannot export another organisation");
        return;
      }

      const org = await prisma.org.findUnique({
        where: { id: orgId },
        include: { users: true, lines: true },
      });
      if (!org) {
        sendError(reply, 404, "org_not_found", "Organisation not found");
        return;
      }

      const exportPayload = buildOrgExport(org as ExportableOrg);
      if (!(await recordAudit(req, reply, principal, "admin.org.export", { orgId }))) {
        return;
      }
      return reply.send({ export: exportPayload });
    },
  );

  app.delete(
    "/admin/delete/:orgId",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const principal = await requirePrincipal(app, req, reply, ["admin"]);
      if (!principal) {
        return;
      }

      const { orgId } = req.params as { orgId: string };
      if (principal.orgId !== orgId) {
        sendError(reply, 403, "forbidden", "Cannot delete another organisation");
        return;
      }

      const org = await prisma.org.findUnique({
        where: { id: orgId },
        include: { users: true, lines: true },
      });
      if (!org) {
        sendError(reply, 404, "org_not_found", "Organisation not found");
        return;
      }
      if (org.deletedAt) {
        sendError(reply, 409, "already_deleted", "Organisation already deleted");
        return;
      }

      const exportPayload = buildOrgExport(org as ExportableOrg);
      const deletedAt = new Date();
      const tombstonePayload: AdminOrgExport = {
        ...exportPayload,
        org: { ...exportPayload.org, deletedAt: deletedAt.toISOString() },
      };

      await prisma.$transaction(async (tx) => {
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

      if (!(await recordAudit(req, reply, principal, "admin.org.delete", { orgId }))) {
        return;
      }

      return reply.send({ status: "deleted", deletedAt: deletedAt.toISOString() });
    },
  );

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
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
      payee: decryptField(line.payeeCiphertext, line.payeeKid),
      desc: decryptField(line.descCiphertext, line.descKid),
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


declare module "fastify" {
  interface FastifyRequest {
    traceSpan?: Span | null;
  }
}
