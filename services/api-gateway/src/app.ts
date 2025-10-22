import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createHash } from "node:crypto";
import type { Org, User, BankLine, PrismaClient, Prisma } from "@prisma/client";

import { maskError, maskObject } from "@apgms/shared";
import { bankLineQuerySchema, createBankLineSchema } from "./schemas/bank-lines";

const ADMIN_HEADER = "x-admin-token";
const IDEMPOTENCY_HEADER = "idempotency-key";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type IdempotencyRecord = {
  hash: string;
  statusCode: number;
  response: unknown;
  timestamp: number;
};

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
  const idempotencyCache = new Map<string, IdempotencyRecord>();

  const cleanupIdempotencyCache = (now: number) => {
    for (const [key, record] of idempotencyCache) {
      if (now - record.timestamp > IDEMPOTENCY_TTL_MS) {
        idempotencyCache.delete(key);
      }
    }
  };

  const cacheKeyFor = (orgId: string, key: string) => `${orgId}:${key}`;

  app.register(cors, { origin: true });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { users };
  });

  app.get("/bank-lines", async (req, rep) => {
    const parsedQuery = bankLineQuerySchema.safeParse(req.query ?? {});
    if (!parsedQuery.success) {
      return rep.code(400).send({
        error: "invalid_query",
        details: parsedQuery.error.issues,
      });
    }

    const { take, from, to } = parsedQuery.data;
    const where: Prisma.BankLineWhereInput = {};
    if (from || to) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (from) {
        dateFilter.gte = new Date(from);
      }
      if (to) {
        dateFilter.lte = new Date(to);
      }
      where.date = dateFilter;
    }

    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take,
      where,
    });
    return { lines };
  });

  app.post("/bank-lines", async (req, rep) => {
    const rawKey = req.headers[IDEMPOTENCY_HEADER as keyof typeof req.headers];
    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!idempotencyKey) {
      return rep.code(400).send({ error: "idempotency_key_required" });
    }

    if (idempotencyKey.length > 64) {
      return rep.code(400).send({ error: "idempotency_key_too_long" });
    }

    const parsedBody = createBankLineSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return rep.code(400).send({
        error: "invalid_body",
        details: parsedBody.error.issues,
      });
    }

    const payload = parsedBody.data;
    const now = Date.now();
    cleanupIdempotencyCache(now);

    const bodyHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const cacheKey = cacheKeyFor(payload.orgId, idempotencyKey);
    const existing = idempotencyCache.get(cacheKey);

    if (existing) {
      if (existing.hash === bodyHash) {
        return rep.code(existing.statusCode).send(existing.response);
      }
      return rep.code(409).send({ error: "idempotency_conflict" });
    }

    try {
      const created = await prisma.bankLine.create({
        data: {
          orgId: payload.orgId,
          date: new Date(payload.date),
          amount: payload.amount as any,
          payee: payload.memo ?? "",
          desc: payload.memo ?? "",
        },
      });

      idempotencyCache.set(cacheKey, {
        hash: bodyHash,
        response: created,
        statusCode: 201,
        timestamp: now,
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
