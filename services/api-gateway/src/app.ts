import { createHash, webcrypto } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import type { Org, User, BankLine, PrismaClient } from "@prisma/client";

import { maskError, maskObject } from "@apgms/shared";

import { maskEmailForRole } from "./lib/pii";
import {
  createBankLineBodySchema,
  createBankLineHeadersSchema,
  createBankLineResponseSchema,
  getBankLinesQuerySchema,
  listBankLinesResponseSchema,
} from "./schemas/bank-lines";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

interface AuthenticatedUser {
  orgId: string;
  role: string;
}

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

let cachedPrisma: PrismaClient | null = null;

interface JWK {
  kid?: string;
  kty: string;
  n?: string;
  e?: string;
  alg?: string;
  crv?: string;
  x?: string;
  y?: string;
  use?: string;
}

interface JWKSResponse {
  keys: JWK[];
}

type IdempotencyRecord = {
  hash: string;
  response: unknown;
  statusCode: number;
  expiresAt: number;
};

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const idempotencyStore = new Map<string, IdempotencyRecord>();

function cleanupIdempotency(): void {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (record.expiresAt <= now) {
      idempotencyStore.delete(key);
    }
  }
}

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

  app.register(cors, { origin: true });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", { preHandler: authenticate }, async (req) => {
    const user = req.user!;
    const users = await prisma.user.findMany({
      where: { orgId: user.orgId },
      select: { email: true, orgId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      users: users.map((item) => ({
        email: maskEmailForRole(item.email, user.role),
        orgId: item.orgId,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  });

  app.get("/bank-lines", { preHandler: authenticate }, async (req, rep) => {
    const user = req.user!;
    let query;
    try {
      query = getBankLinesQuerySchema.parse(req.query ?? {});
    } catch (error) {
      req.log.warn({ err: maskError(error) }, "invalid bank line query");
      return rep.code(400).send({ error: "bad_request" });
    }
    const lines = await prisma.bankLine.findMany({
      where: { orgId: user.orgId },
      orderBy: { date: "desc" },
      take: query.take ?? 20,
    });
    const payload = {
      lines: lines.map((line) => serializeBankLine(line)),
    };
    return listBankLinesResponseSchema.parse(payload);
  });

  app.post("/bank-lines", { preHandler: authenticate }, async (req, rep) => {
    try {
      const user = req.user!;
      const body = createBankLineBodySchema.parse(req.body ?? {});
      const headers = createBankLineHeadersSchema.parse({
        idempotencyKey: getIdempotencyKey(req.headers),
      });

      const idempotencyKey = headers.idempotencyKey;
      const idempotencyHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
      const compositeKey = `${user.orgId}:${idempotencyKey}`;

      cleanupIdempotency();
      const existing = idempotencyStore.get(compositeKey);
      if (existing) {
        if (existing.hash === idempotencyHash) {
          return rep.code(existing.statusCode).send(existing.response);
        }
        return rep.code(409).send({ error: "idempotency_conflict" });
      }

      const created = await prisma.bankLine.create({
        data: {
          orgId: user.orgId,
          date: new Date(body.date),
          amount: body.amount as any,
          payee: body.payee,
          desc: body.desc,
        },
      });

      const responsePayload = createBankLineResponseSchema.parse({
        line: serializeBankLine(created),
      });

      idempotencyStore.set(compositeKey, {
        hash: idempotencyHash,
        response: responsePayload,
        statusCode: 201,
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
      });

      return rep.code(201).send(responsePayload);
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

async function authenticate(req: FastifyRequest, rep: FastifyReply): Promise<void> {
  try {
    const user = await resolveUser(req);
    if (!user) {
      throw new Error("unauthenticated");
    }
    req.user = user;
  } catch (error) {
    req.log.warn({ err: maskError(error) }, "request unauthenticated");
    void rep.code(401).send({ error: "unauthenticated" });
  }
}

async function resolveUser(req: FastifyRequest): Promise<AuthenticatedUser | null> {
  const jwksUrl = process.env.AUTH_JWKS_URL;
  const audience = process.env.AUTH_AUDIENCE;
  const issuer = process.env.AUTH_ISSUER;

  if (jwksUrl && audience && issuer) {
    return verifyJwtWithJWKS(req, { jwksUrl, audience, issuer });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return null;
  }

  const provided = extractSingleHeader(req.headers["x-api-key"]);
  if (provided !== apiKey) {
    return null;
  }

  const orgId = extractSingleHeader(req.headers["x-org-id"]);
  if (!orgId) {
    throw new Error("missing_org_id");
  }
  const role = extractSingleHeader(req.headers["x-user-role"]) ?? "member";

  return { orgId, role };
}

async function verifyJwtWithJWKS(
  req: FastifyRequest,
  config: { jwksUrl: string; audience: string; issuer: string },
): Promise<AuthenticatedUser | null> {
  const token = getBearerToken(req.headers);
  if (!token) {
    return null;
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    throw new Error("invalid_token");
  }

  const header = JSON.parse(base64UrlDecode(segments[0]).toString("utf8")) as { kid?: string; alg?: string };
  const payload = JSON.parse(base64UrlDecode(segments[1]).toString("utf8")) as Record<string, unknown>;

  if (!header.kid) {
    throw new Error("missing_kid");
  }
  if (header.alg !== "RS256") {
    throw new Error("unsupported_algorithm");
  }

  const jwk = await getJwk(config.jwksUrl, header.kid);
  if (!jwk) {
    throw new Error("key_not_found");
  }

  const data = new TextEncoder().encode(`${segments[0]}.${segments[1]}`);
  const signature = base64UrlDecode(segments[2]);
  const key = await webcrypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await webcrypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, signature, data);
  if (!verified) {
    throw new Error("invalid_signature");
  }

  const audClaim = payload.aud;
  if (typeof audClaim === "string") {
    if (audClaim !== config.audience) {
      throw new Error("invalid_audience");
    }
  } else if (Array.isArray(audClaim)) {
    if (!audClaim.includes(config.audience)) {
      throw new Error("invalid_audience");
    }
  } else {
    throw new Error("invalid_audience");
  }

  if (payload.iss !== config.issuer) {
    throw new Error("invalid_issuer");
  }

  const orgId = (payload.orgId ?? payload.org_id) as string | undefined;
  if (!orgId) {
    throw new Error("missing_org_id");
  }
  const role = (payload.role as string | undefined) ?? "member";

  return { orgId, role };
}

const jwksCache = new Map<string, { fetchedAt: number; keys: JWK[] }>();
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;

async function getJwk(url: string, kid: string): Promise<JWK | undefined> {
  const cached = jwksCache.get(url);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys.find((key) => key.kid === kid);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`jwks_fetch_failed:${response.status}`);
  }
  const jwks = (await response.json()) as JWKSResponse;
  jwksCache.set(url, { fetchedAt: now, keys: jwks.keys });
  return jwks.keys.find((key) => key.kid === kid);
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

function getBearerToken(headers: FastifyRequest["headers"]): string | null {
  const authorization = extractSingleHeader(headers.authorization);
  if (!authorization) {
    return null;
  }
  const match = /^Bearer\s+(?<token>.+)$/i.exec(authorization);
  return match?.groups?.token ?? null;
}

function extractSingleHeader(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

function getIdempotencyKey(headers: FastifyRequest["headers"]): string | undefined {
  return extractSingleHeader(headers["idempotency-key"]);
}

function serializeBankLine(line: BankLine): {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  desc: string;
  createdAt: string;
} {
  return {
    id: line.id,
    orgId: line.orgId,
    date: line.date instanceof Date ? line.date.toISOString() : new Date(line.date).toISOString(),
    amount: normaliseAmount(line.amount),
    payee: line.payee,
    desc: line.desc,
    createdAt: line.createdAt instanceof Date ? line.createdAt.toISOString() : new Date(line.createdAt).toISOString(),
  };
}
