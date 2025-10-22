import { createHmac, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "./plugins/helmet";
import type { Org, User, BankLine, PrismaClient } from "@prisma/client";

import { maskError, maskObject } from "@apgms/shared";
import { BankLinePostSchema, BankLineQuerySchema, type BankLinePostInput } from "./schemas/bank-lines";

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

type UserRole = "admin" | "member";

interface AuthenticatedUser {
  orgId: string;
  role: UserRole;
}

type CachedResponse = { statusCode: number; payload: unknown };

const idempotencyCache = new Map<string, CachedResponse>();

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

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

  const allow = (process.env.CORS_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  app.register(cors, {
    origin: (origin, callback) => {
      callback(null, !origin || allow.includes(origin));
    },
  });

  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...allow],
        frameAncestors: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  });

  app.decorateRequest("user", null as unknown as AuthenticatedUser);

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get(
    "/users",
    { preHandler: [authenticate] },
    async (req) => {
      const users = await prisma.user.findMany({
        select: { email: true, orgId: true, createdAt: true },
        where: { orgId: req.user.orgId },
        orderBy: { createdAt: "desc" },
      });
      return { users: redactUsers(users, req.user.role) };
    },
  );

  app.get(
    "/bank-lines",
    { preHandler: [authenticate] },
    async (req, rep) => {
      const parsedQuery = BankLineQuerySchema.safeParse(req.query ?? {});
      if (!parsedQuery.success) {
        return rep.code(400).send({ error: "invalid_query", details: parsedQuery.error.flatten() });
      }
      const { take } = parsedQuery.data;
      const lines = await prisma.bankLine.findMany({
        where: { orgId: req.user.orgId },
        orderBy: { date: "desc" },
        take,
      });
      return { lines };
    },
  );

  app.post(
    "/bank-lines",
    { preHandler: [authenticate] },
    async (req, rep) => {
      const idempotencyKey = getHeader(req, "idempotency-key");
      if (!idempotencyKey || idempotencyKey.length > 64) {
        return rep.code(400).send({ error: "missing_idempotency_key" });
      }

      const parsedBody = BankLinePostSchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        req.log.warn({ err: parsedBody.error.flatten() }, "invalid bank line payload");
        return rep.code(400).send({ error: "invalid_body", details: parsedBody.error.flatten() });
      }

      const cacheKey = `${req.user.orgId}:${idempotencyKey}`;
      const cached = idempotencyCache.get(cacheKey);
      if (cached) {
        return rep.code(cached.statusCode).header("idempotent-replay", "true").send(cached.payload);
      }

      try {
        const created = await prisma.bankLine.create({
          data: mapBankLineInput(req.user.orgId, parsedBody.data),
        });
        const payload = created;
        const cachedResponse: CachedResponse = { statusCode: 201, payload };
        idempotencyCache.set(cacheKey, cachedResponse);
        return rep.code(201).send(payload);
      } catch (error) {
        req.log.error({ err: maskError(error) }, "failed to create bank line");
        return rep.code(400).send({ error: "bad_request" });
      }
    },
  );

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

async function authenticate(req: FastifyRequest, rep: FastifyReply) {
  const user = extractUser(req);
  if (!user) {
    return rep.code(401).send({ error: "unauthorized" });
  }
  req.user = user;
}

function extractUser(req: FastifyRequest): AuthenticatedUser | null {
  const secret = process.env.AUTH_JWT_SECRET;
  const authorization = getHeader(req, "authorization");
  if (authorization && authorization.startsWith("Bearer ") && secret) {
    const token = authorization.slice("Bearer ".length);
    const payload = verifyJwt(token, secret);
    if (payload && typeof payload.orgId === "string" && isRole(payload.role)) {
      return { orgId: payload.orgId, role: payload.role };
    }
  }

  const expectedApiKey = process.env.AUTH_API_KEY;
  const providedApiKey = getHeader(req, "x-api-key");
  if (expectedApiKey && providedApiKey === expectedApiKey) {
    const orgId = getHeader(req, "x-org-id");
    const roleHeader = getHeader(req, "x-user-role");
    if (orgId && roleHeader && isRole(roleHeader)) {
      return { orgId, role: roleHeader };
    }
  }

  return null;
}

function isRole(value: unknown): value is UserRole {
  return value === "admin" || value === "member";
}

function verifyJwt(token: string, secret: string): Record<string, any> | null {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }
  const [headerB64, payloadB64, signatureB64] = segments;

  let headerJson: string;
  let payloadJson: string;
  try {
    headerJson = decodeBase64Url(headerB64);
    payloadJson = decodeBase64Url(payloadB64);
  } catch {
    return null;
  }

  let header: Record<string, any>;
  let payload: Record<string, any>;
  try {
    header = JSON.parse(headerJson);
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  if (header.alg !== "HS256") {
    return null;
  }

  const expected = createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signatureB64, "base64url");
  } catch {
    return null;
  }

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return null;
  }

  return payload;
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getHeader(req: FastifyRequest, name: string): string | undefined {
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

function mapBankLineInput(orgId: string, input: BankLinePostInput) {
  return {
    orgId,
    date: new Date(input.date),
    amount: input.amount,
    payee: input.payee,
    desc: input.memo ?? input.desc ?? "",
  };
}

function redactUsers(
  users: Array<{ email: string; orgId: string; createdAt: Date }>,
  role: UserRole,
): Array<{ email: string | null; orgId: string; createdAt: Date }> {
  if (role === "admin") {
    return users;
  }
  return users.map((user) => ({ ...user, email: null }));
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
