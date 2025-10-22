import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import cors from "@fastify/cors";
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
>;

type PrismaWithHealthChecks = PrismaLike & {
  $queryRaw?: (...args: unknown[]) => Promise<unknown>;
  $queryRawUnsafe?: (...args: unknown[]) => Promise<unknown>;
  $runCommandRaw?: (...args: unknown[]) => Promise<unknown>;
};

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
  const prismaWithHealth = prisma as PrismaWithHealthChecks;

  const app = Fastify({ logger: true });

  app.decorate("prisma", prisma);

  const routeStatusCounters = new Map<string, number>();

  app.register(cors, { origin: true });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/ready", async (req, rep) => {
    try {
      await ensurePrismaReady(prismaWithHealth);
      return rep.code(200).send({ ready: true });
    } catch (error) {
      req.log.error({ err: maskError(error) }, "prisma readiness check failed");
      const reason =
        error instanceof Error && error.message === "prisma_health_check_unavailable"
          ? error.message
          : "prisma_unavailable";
      return rep.code(503).send({ ready: false, reason });
    }
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

  app.get("/metrics", async (_req, rep) => {
    const payload = formatMetrics(routeStatusCounters);
    return rep
      .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
      .send(payload);
  });

  app.addHook("onResponse", async (req, reply) => {
    const method = req.method;
    const route = resolveRoute(req);
    const status = reply.statusCode;
    const key = `${method}|${route}|${status}`;
    routeStatusCounters.set(key, (routeStatusCounters.get(key) ?? 0) + 1);
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

async function ensurePrismaReady(prisma: PrismaWithHealthChecks): Promise<void> {
  if (typeof prisma.$queryRaw === "function") {
    await prisma.$queryRaw`SELECT 1`;
    return;
  }
  if (typeof prisma.$queryRawUnsafe === "function") {
    await prisma.$queryRawUnsafe("SELECT 1");
    return;
  }
  if (typeof prisma.$runCommandRaw === "function") {
    await prisma.$runCommandRaw({ ping: 1 });
    return;
  }
  if (typeof prisma.$transaction === "function") {
    await prisma.$transaction(async () => null);
    return;
  }
  throw new Error("prisma_health_check_unavailable");
}

function formatMetrics(counters: Map<string, number>): string {
  const lines: string[] = [
    "# HELP api_route_status_total Count of HTTP responses by route, method, and status.",
    "# TYPE api_route_status_total counter",
  ];

  const entries = Array.from(counters.entries()).map(([key, value]) => {
    const [method, route, status] = key.split("|");
    return { method, route, status, value };
  });

  entries.sort((a, b) => {
    if (a.route !== b.route) {
      return a.route.localeCompare(b.route);
    }
    if (a.method !== b.method) {
      return a.method.localeCompare(b.method);
    }
    return Number(a.status) - Number(b.status);
  });

  for (const entry of entries) {
    lines.push(
      `api_route_status_total{method="${escapeLabelValue(entry.method)}",route="${escapeLabelValue(entry.route)}",status="${escapeLabelValue(entry.status)}"} ${entry.value}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function resolveRoute(req: FastifyRequest): string {
  const asAny = req as FastifyRequest & { routeOptions?: { url?: string } };
  return req.routerPath ?? asAny.routeOptions?.url ?? req.url;
}
