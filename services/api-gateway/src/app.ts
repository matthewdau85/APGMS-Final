import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { Prisma, type Org, type User, type BankLine, type PrismaClient } from "@prisma/client";

import { maskError, maskObject } from "@apgms/shared";

import {
  AdminAuthError,
  createAdminVerifier,
  loadAdminConfigFromEnv,
  type AdminClaims,
  type AdminVerifier,
} from "./lib/admin-auth";
import { registerPIIRoutes, type AdminGuard } from "./lib/pii";

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

async function loadDefaultPrisma(): Promise<PrismaLike> {
  if (!cachedPrisma) {
    const module = (await import("@apgms/shared/db")) as { prisma: PrismaClient };
    cachedPrisma = module.prisma;
  }
  return cachedPrisma as PrismaLike;
}

/** Zod body schema for creating a bank line */
const CreateLine = z.object({
  date: z.string().datetime(),                     // ISO 8601 string
  amount: z.string().regex(/^-?\d+(\.\d+)?$/),     // decimal as string
  payee: z.string().min(1),
  desc: z.string().min(1),
  orgId: z.string().min(1),
});

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const prisma = (options.prisma as PrismaLike | undefined) ?? (await loadDefaultPrisma());

  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  let adminVerifier: AdminVerifier | null = null;
  try {
    adminVerifier = createAdminVerifier(loadAdminConfigFromEnv());
  } catch (error) {
    app.log.error({ err: maskError(error) }, "failed to configure admin auth");
  }

  const piiGuard: AdminGuard = async (request) => {
    if (!adminVerifier) {
      request.log.error("admin auth not configured");
      return { allowed: false, actorId: "" };
    }

    try {
      const claims = adminVerifier.verifyRequest(request, { requiredRole: "admin" });
      const actorId = typeof claims.sub === "string" ? claims.sub : "";
      return { allowed: true, actorId };
    } catch (error) {
      if (error instanceof AdminAuthError) {
        request.log.warn({ code: error.code }, "admin auth denied for pii route");
        return { allowed: false, actorId: "" };
      }
      request.log.error({ err: maskError(error) }, "unexpected admin auth failure for pii route");
      return { allowed: false, actorId: "" };
    }
  };

  registerPIIRoutes(app, piiGuard);

  async function requireAdmin(
    req: FastifyRequest,
    rep: FastifyReply,
    orgId?: string,
  ): Promise<AdminClaims | null> {
    if (!adminVerifier) {
      req.log.error("admin auth not configured");
      void rep.code(500).send({ error: "admin_config_missing" });
      return null;
    }

    try {
      return adminVerifier.verifyRequest(req, { requiredRole: "admin", orgId });
    } catch (error) {
      if (error instanceof AdminAuthError) {
        if (error.statusCode >= 500) {
          req.log.error({ err: maskError(error), code: error.code }, "admin auth validation failed");
        } else {
          req.log.warn({ code: error.code }, "admin auth denied");
        }
        void rep.code(error.statusCode).send({ error: error.code });
        return null;
      }
      req.log.error({ err: maskError(error) }, "unexpected admin auth error");
      void rep.code(500).send({ error: "admin_auth_error" });
      return null;
    }
  }

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  // Readiness: pings the DB
  app.get("/ready", async (req, reply) => {
    try {
      // Raw ping; works across providers
      await prisma.$queryRaw`SELECT 1`;
      return reply.code(200).send({ ready: true });
    } catch {
      return reply.code(503).send({ ready: false });
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

  // --- Validated + idempotent create ---
  app.post("/bank-lines", async (req, reply) => {
    const parsed = CreateLine.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const { orgId, date, amount, payee, desc } = parsed.data;
    const keyHeader = (req.headers["idempotency-key"] as string | undefined)?.trim();
    const idemKey = keyHeader && keyHeader.length > 0 ? keyHeader : undefined;

    try {
      if (idemKey) {
        // Upsert on the compound unique key @@unique([orgId, idempotencyKey])
        const line = await prisma.bankLine.upsert({
          where: { orgId_idempotencyKey: { orgId, idempotencyKey: idemKey } },
          create: {
            orgId,
            date: new Date(date),
            amount: new Prisma.Decimal(amount),
            payee,
            desc,
            idempotencyKey: idemKey,
          },
          update: {}, // replay → no-op
          select: {
            id: true, orgId: true, date: true, amount: true, payee: true, desc: true, createdAt: true, idempotencyKey: true
          },
        });

        reply.header("Idempotency-Status", "reused");
        return reply.code(200).send(line);
      }

      // No idempotency key → plain create
      const created = await prisma.bankLine.create({
        data: {
          orgId,
          date: new Date(date),
          amount: new Prisma.Decimal(amount),
          payee,
          desc,
        },
        select: {
          id: true, orgId: true, date: true, amount: true, payee: true, desc: true, createdAt: true, idempotencyKey: true
        },
      });

      return reply.code(201).send(created);
    } catch (e) {
      // If a race slipped through, surface an idempotency-ish signal
      req.log.error({ err: maskError(e) }, "failed to create bank line");
      return reply.code(400).send({ error: "bad_request" });
    }
  });
  // --- /validated + idempotent create ---

  app.get("/admin/export/:orgId", async (req, rep) => {
    const { orgId } = req.params as { orgId: string };
    if (!(await requireAdmin(req, rep, orgId))) {
      return;
    }
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
    const { orgId } = req.params as { orgId: string };
    if (!(await requireAdmin(req, rep, orgId))) {
      return;
    }
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
