import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { type Org, type User, type BankLine, type PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

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

const BankLinesQuery = z
  .object({
    take: z.coerce.number().int().min(1).max(200).default(20),
    skip: z.coerce.number().int().min(0).max(1000).default(0),
    sort: z.enum(["date", "amount"]).default("date"),
    direction: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

const PrincipalSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  role: z.enum(["admin", "user"]),
  email: z.string().email(),
});

type Principal = z.infer<typeof PrincipalSchema>;

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const prisma = (options.prisma as PrismaLike | undefined) ?? (await loadDefaultPrisma());

  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

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

  app.get("/users", async (req, reply) => {
    const principal = parsePrincipal(req);
    if (!principal) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const users = await prisma.user.findMany({
      where: { orgId: principal.orgId },
      select: { id: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return {
      users: users.map((user) => ({
        id: user.id,
        email: maskEmail(user.email),
        createdAt: normaliseDate(user.createdAt),
      })),
    };
  });

  app.get("/bank-lines", async (req, reply) => {
    const parsed = BankLinesQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const { take, skip, sort, direction } = parsed.data;
    const orderBy = sort === "amount" ? { amount: direction } : { date: direction };

    const lines = await prisma.bankLine.findMany({
      orderBy,
      skip,
      take,
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
            amount: new Decimal(amount),
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
          amount: new Decimal(amount),
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

function parsePrincipal(req: FastifyRequest): Principal | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;

  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  if (!match) return null;

  try {
    const decoded = Buffer.from(match[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return PrincipalSchema.parse(parsed);
  } catch {
    return null;
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) {
    return "***";
  }

  const first = local.charAt(0) || "*";
  const last = local.length > 1 ? local.charAt(local.length - 1) : "";
  const maskedLocal = last ? `${first}***${last}` : `${first}***`;
  return `${maskedLocal}@${domain}`;
}

function normaliseDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date(0).toISOString();
}
