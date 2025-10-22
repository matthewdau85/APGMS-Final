import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { type Org, type User, type BankLine, type PrismaClient } from "@prisma/client";

import { maskError, maskObject } from "@apgms/shared";
import { errorSchema, paginateQuery } from "./schemas/common";

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
  | "$queryRaw"
>;

let cachedPrisma: PrismaClient | null = null;

async function loadDefaultPrisma(): Promise<PrismaLike> {
  if (!cachedPrisma) {
    const module = (await import("@apgms/shared/db")) as { prisma: PrismaClient };
    cachedPrisma = module.prisma;
  }
  return cachedPrisma as PrismaLike;
}

const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("api-gateway"),
});

const readyResponseSchema = z.object({ ready: z.boolean() });

const userSummarySchema = z.object({
  email: z.string().email(),
  orgId: z.string(),
  createdAt: z.string(),
});

const usersResponseSchema = z.object({ users: z.array(userSummarySchema) });

const bankLineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  date: z.string(),
  amount: z.number(),
  payee: z.string(),
  desc: z.string(),
  createdAt: z.string(),
  idempotencyKey: z.string().nullable().optional(),
});

const bankLineListResponseSchema = z.object({
  lines: z.array(bankLineSchema),
});

const bankLineResponseSchema = bankLineSchema;

const createBankLineSchema = z.object({
  date: z.string().datetime(),
  amount: z
    .union([
      z.number().finite(),
      z
        .string()
        .regex(/^-?\d+(\.\d+)?$/, { message: "amount must be a decimal" }),
    ]),
  payee: z.string().min(1),
  desc: z.string().min(1),
  orgId: z.string().min(1),
  idempotencyKey: z.string().min(8).optional(),
});

const adminExportResponseSchema = z.object({
  export: z.object({
    org: z.object({
      id: z.string(),
      name: z.string(),
      createdAt: z.string(),
      deletedAt: z.string().nullable(),
    }),
    users: z.array(
      z.object({ id: z.string(), email: z.string().email(), createdAt: z.string() })
    ),
    bankLines: z.array(
      z.object({
        id: z.string(),
        date: z.string(),
        amount: z.number(),
        payee: z.string(),
        desc: z.string(),
        createdAt: z.string(),
      })
    ),
  }),
});

const adminDeleteResponseSchema = z.object({
  status: z.literal("deleted"),
  deletedAt: z.string(),
});

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const prisma = (options.prisma as PrismaLike | undefined) ?? (await loadDefaultPrisma());

  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => healthResponseSchema.parse({ ok: true, service: "api-gateway" }));

  // Readiness: pings the DB
  app.get("/ready", async (_req, reply) => {
    try {
      // Raw ping; works across providers
      await prisma.$queryRaw`SELECT 1`;
      return reply.code(200).send(readyResponseSchema.parse({ ready: true }));
    } catch {
      return reply.code(503).send(readyResponseSchema.parse({ ready: false }));
    }
  });

  app.get("/users", async () => {
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return usersResponseSchema.parse({
      users: users.map((user) => ({
        email: user.email,
        orgId: user.orgId,
        createdAt: user.createdAt.toISOString(),
      })),
    });
  });

  app.get("/bank-lines", async (req, reply) => {
    const queryResult = paginateQuery.safeParse(req.query);
    if (!queryResult.success) {
      return sendValidationError(reply, queryResult.error);
    }

    const { cursor, limit } = queryResult.data;

    const lines = await prisma.bankLine.findMany({
      orderBy: { date: "desc" },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
    });

    return bankLineListResponseSchema.parse({
      lines: lines.map(mapBankLine),
    });
  });

  // --- Validated + idempotent create ---
  app.post("/bank-lines", async (req, reply) => {
    const parsed = createBankLineSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error);
    }

    const { orgId, date, amount, payee, desc, idempotencyKey } = parsed.data;
    const keyHeader = (req.headers["idempotency-key"] as string | undefined)?.trim();
    const idemKey =
      keyHeader && keyHeader.length > 0 ? keyHeader : idempotencyKey ? idempotencyKey : undefined;

    try {
      if (idemKey) {
        const line = await prisma.bankLine.upsert({
          where: { orgId_idempotencyKey: { orgId, idempotencyKey: idemKey } },
          create: {
            orgId,
            date: new Date(date),
            amount: typeof amount === "number" ? amount : amount,
            payee,
            desc,
            idempotencyKey: idemKey,
          },
          update: {},
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
        });

        reply.header("Idempotency-Status", "reused");
        return reply
          .code(200)
          .send(bankLineResponseSchema.parse(mapBankLine(line)));
      }

      const created = await prisma.bankLine.create({
        data: {
          orgId,
          date: new Date(date),
          amount: typeof amount === "number" ? amount : amount,
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
      });

      return reply
        .code(201)
        .send(bankLineResponseSchema.parse(mapBankLine(created)));
    } catch (e) {
      req.log.error({ err: maskError(e) }, "failed to create bank line");
      return sendError(reply, 400, "Bad Request");
    }
  });
  // --- /validated + idempotent create ---

  const adminParamsSchema = z.object({ orgId: z.string().min(1) });

  app.get("/admin/export/:orgId", async (req, rep) => {
    if (!requireAdmin(req, rep)) {
      return;
    }

    const paramsResult = adminParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return sendValidationError(rep, paramsResult.error);
    }

    const { orgId } = paramsResult.data;
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      include: { users: true, lines: true },
    });
    if (!org) {
      return sendError(rep, 404, "Not Found");
    }

    const exportPayload = buildOrgExport(org as ExportableOrg);
    return rep.send(adminExportResponseSchema.parse({ export: exportPayload }));
  });

  app.delete("/admin/delete/:orgId", async (req, rep) => {
    if (!requireAdmin(req, rep)) {
      return;
    }

    const paramsResult = adminParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return sendValidationError(rep, paramsResult.error);
    }

    const { orgId } = paramsResult.data;
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      include: { users: true, lines: true },
    });
    if (!org) {
      return sendError(rep, 404, "Not Found");
    }
    if (org.deletedAt) {
      return sendError(rep, 409, "Conflict");
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

    return rep.send(
      adminDeleteResponseSchema.parse({
        status: "deleted",
        deletedAt: deletedAt.toISOString(),
      })
    );
  });

  app.setErrorHandler((err, req, reply) => {
    const status = err.validation ? 400 : err.statusCode ?? 500;
    const statusMessages: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      409: "Conflict",
      502: "Bad Gateway",
    };
    const safeMsg =
      status >= 500
        ? "Internal Server Error"
        : statusMessages[status] ?? "Error";
    req.log.error({ err: { name: err.name, code: (err as any).code } }, "request_error");
    reply.code(status).send(errorSchema.parse({ error: safeMsg }));
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
    void sendError(rep, 500, "Internal Server Error");
    return false;
  }

  const provided =
    req.headers[ADMIN_HEADER] ??
    req.headers[ADMIN_HEADER.toUpperCase() as keyof typeof req.headers];
  const providedValue = Array.isArray(provided) ? provided[0] : provided;

  if (providedValue !== configuredToken) {
    void sendError(rep, 403, "Forbidden");
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

function mapBankLine(line: {
  id: string;
  orgId: string;
  date: Date;
  amount: unknown;
  payee: string;
  desc: string;
  createdAt: Date;
  idempotencyKey: string | null;
}) {
  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date.toISOString(),
    amount: normaliseAmount(line.amount),
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt.toISOString(),
    idempotencyKey: line.idempotencyKey,
  };
}

function sendValidationError(reply: FastifyReply, error: z.ZodError<unknown>) {
  return sendError(reply, 400, "Bad Request", error.flatten());
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  details?: unknown
) {
  const safeMessage = statusCode >= 500 && message !== "Internal Server Error" ? "Internal Server Error" : message;
  const payload = errorSchema.parse(
    details ? { error: safeMessage, details } : { error: safeMessage }
  );
  return reply.code(statusCode).send(payload);
}
