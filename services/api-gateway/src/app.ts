import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";
import type { Org, User, BankLine, PrismaClient } from "@prisma/client";

import { maskError, maskObject } from "@apgms/shared";

const ADMIN_HEADER = "x-admin-token";

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
  | "org"
  | "user"
  | "bankLine"
  | "orgTombstone"
  | "$transaction"
  | "$disconnect"
> & {
  $runHealthCheck?: () => Promise<void>;
};

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaLike;
  }
}

let metricsRegistry: Registry | null = null;
let requestCounter: Counter<"method" | "route" | "status">;
let requestDuration: Histogram<"method" | "route" | "status">;

function ensureMetrics(): {
  registry: Registry;
  counter: Counter<"method" | "route" | "status">;
  duration: Histogram<"method" | "route" | "status">;
} {
  if (!metricsRegistry) {
    metricsRegistry = new Registry();
    collectDefaultMetrics({ register: metricsRegistry });

    requestCounter = new Counter({
      name: "api_gateway_requests_total",
      help: "Total number of requests received",
      labelNames: ["method", "route", "status"],
      registers: [metricsRegistry],
    });

    requestDuration = new Histogram({
      name: "api_gateway_request_duration_seconds",
      help: "Duration of requests in seconds",
      labelNames: ["method", "route", "status"],
      buckets: [
        0.005,
        0.01,
        0.025,
        0.05,
        0.1,
        0.25,
        0.5,
        1,
        2.5,
        5,
      ],
      registers: [metricsRegistry],
    });
  }

  return {
    registry: metricsRegistry!,
    counter: requestCounter!,
    duration: requestDuration!,
  };
}

let cachedPrisma: PrismaClient | null = null;

async function loadDefaultPrisma(): Promise<PrismaLike> {
  if (!cachedPrisma) {
    const module = (await import("@apgms/shared/src/db")) as { prisma: PrismaClient };
    cachedPrisma = module.prisma;
  }
  return cachedPrisma as PrismaLike;
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const prisma = (options.prisma as PrismaLike | undefined) ?? (await loadDefaultPrisma());

  const app = Fastify({ logger: true });
  app.decorate("prisma", prisma);

  const { registry, counter, duration } = ensureMetrics();

  app.register(cors, { origin: true });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/ready", async (_req, rep) => {
    try {
      if (typeof prisma.$runHealthCheck === "function") {
        await prisma.$runHealthCheck();
      } else if (prisma.user && typeof prisma.user.findFirst === "function") {
        await prisma.user.findFirst({ select: { id: true } });
      }
      return rep.code(200).send({ status: "ready" });
    } catch (err) {
      app.log.error({ err: maskError(err) }, "readiness check failed");
      return rep.code(503).send({ status: "unavailable" });
    }
  });

  app.get("/metrics", async (_req, rep) => {
    const metrics = await registry.metrics();
    return rep.header("Content-Type", registry.contentType).send(metrics);
  });

  app.addHook("onRequest", async (req) => {
    (req as any)._metricsStart = process.hrtime.bigint();
  });

  app.addHook("onResponse", async (req, reply) => {
    const start = (req as any)._metricsStart as bigint | undefined;
    const route = req.routeOptions?.url ?? req.routerPath ?? req.raw.url ?? "unknown";
    const status = String(reply.statusCode ?? 0);

    if (start) {
      const diff = process.hrtime.bigint() - start;
      const seconds = Number(diff) / 1e9;
      duration.observe({ method: req.method, route, status }, seconds);
    } else {
      duration.observe({ method: req.method, route, status }, 0);
    }

    counter.inc({ method: req.method, route, status });
  });

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req) => {
    const take = Number((req.query as any).take ?? 20);
    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: Math.min(Math.max(take, 1), 200),
    });
    return { lines };
  });

  app.post("/bank-lines", async (req, rep) => {
    try {
      const body = req.body as {
        orgId: string;
        date: string;
        amount: number | string;
        payee: string;
        desc: string;
      };
      const created = await prisma.bankLine.create({
        data: {
          orgId: body.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });
      return rep.code(201).send(created);
    } catch (e) {
      req.log.error({ err: maskError(e) }, "failed to create bank line");
      return rep.code(400).send({ error: "bad_request" });
    }
  });

  app.get("/admin/export/:orgId", async (req, rep) => {
    if (!requireAdmin(req, rep)) {
      return;
    }
    const { orgId } = req.params as { orgId: string };
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      include: { users: true, lines: true },
    });
    if (!org) {
      return rep.code(404).send({ error: "org_not_found" });
    }

    const exportPayload = buildOrgExport(org as ExportableOrg);
    return rep.send({ export: exportPayload });
  });

  app.delete("/admin/delete/:orgId", async (req, rep) => {
    if (!requireAdmin(req, rep)) {
      return;
    }
    const { orgId } = req.params as { orgId: string };
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      include: { users: true, lines: true },
    });
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

    return rep.send({ status: "deleted", deletedAt: deletedAt.toISOString() });
  });

  app.ready(() => {
    app.log.info(app.printRoutes());
  });

  return app;
}

function requireAdmin(req: FastifyRequest, rep: FastifyReply): boolean {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    req.log.error("ADMIN_TOKEN is not configured");
    void rep.code(500).send({ error: "admin_config_missing" });
    return false;
  }

  const provided = req.headers[ADMIN_HEADER] ?? req.headers[ADMIN_HEADER.toUpperCase() as keyof typeof req.headers];
  const providedValue = Array.isArray(provided) ? provided[0] : provided;

  if (providedValue !== configuredToken) {
    void rep.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
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
  if (typeof amount === "number") {
    return amount;
  }
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
