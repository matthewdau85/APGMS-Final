import { createHash, createPublicKey, createVerify } from "node:crypto";

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import type { Org, User, BankLine, PrismaClient } from "@prisma/client";

import { maskError, maskObject } from "@apgms/shared";
import { bankLinesQuerySchema, createBankLineSchema } from "./schemas/bank-lines";
import { redactEmailIfNeeded } from "./lib/pii";

const ADMIN_HEADER = "x-admin-token";
const API_KEY_HEADER = "x-api-key";
const ORG_HEADER = "x-org-id";
const USER_ROLE_HEADER = "x-user-role";
const IDEMPOTENCY_HEADER = "idempotency-key";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type AuthenticatedUser = {
  orgId: string;
  role: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

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

interface IdempotencyRecord {
  hash: string;
  statusCode: number;
  body: unknown;
  expiresAt: number;
}

function createIdempotencyStore() {
  const store = new Map<string, IdempotencyRecord>();

  return {
    get(key: string): IdempotencyRecord | undefined {
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry;
    },
    set(key: string, value: IdempotencyRecord): void {
      store.set(key, value);
    },
  };
}

function getHeaderValue(request: FastifyRequest, header: string): string | undefined {
  const raw = request.headers[header] ?? request.headers[header.toLowerCase() as keyof typeof request.headers];
  if (!raw) {
    return undefined;
  }
  return Array.isArray(raw) ? raw[0] : raw;
}

function stableHashPayload(payload: unknown): string {
  const stable = JSON.stringify(sortPayload(payload));
  return createHash("sha256").update(stable).digest("hex");
}

function sortPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map((item) => sortPayload(item));
  }
  if (payload && typeof payload === "object") {
    const entries = Object.entries(payload as Record<string, unknown>)
      .map(([key, value]) => [key, sortPayload(value)] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
  }
  return payload;
}

type DecodedJwtPayload = {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  scope?: string | string[];
  [key: string]: unknown;
};

type DecodedJwtHeader = {
  alg?: string;
  kid?: string;
  [key: string]: unknown;
};

interface ParsedJwt {
  header: DecodedJwtHeader;
  payload: DecodedJwtPayload;
  signature: Buffer;
  signingInput: string;
}

interface JwksCacheEntry {
  keys: JsonWebKey[];
  fetchedAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

function extractClaim(payload: DecodedJwtPayload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function createAuthPreHandler(): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const apiKey = process.env.API_KEY;
  const apiKeyOrgId = process.env.API_KEY_ORG_ID;
  const apiKeyRole = process.env.API_KEY_ROLE ?? "admin";

  const jwksUrl = process.env.AUTH_JWKS_URL;
  const audience = process.env.AUTH_AUDIENCE;
  const issuer = process.env.AUTH_ISSUER;

  return async (request, reply) => {
    const authHeader = getHeaderValue(request, "authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (bearerToken && jwksUrl && audience && issuer) {
      try {
        const verified = await verifyJwtToken(bearerToken, jwksUrl, audience, issuer);
        request.user = verified;
        return;
      } catch (error) {
        request.log.warn({ err: maskError(error) }, "jwt verification failed");
        return void reply.code(401).send({ error: "unauthorized" });
      }
    }

    if (apiKey) {
      const providedKey = getHeaderValue(request, API_KEY_HEADER);
      if (providedKey && providedKey === apiKey) {
        const orgId = getHeaderValue(request, ORG_HEADER) ?? apiKeyOrgId;
        if (!orgId) {
          return void reply.code(401).send({ error: "unauthorized" });
        }
        const role = getHeaderValue(request, USER_ROLE_HEADER) ?? apiKeyRole;
        request.user = { orgId, role };
        return;
      }
    }

    return void reply.code(401).send({ error: "unauthorized" });
  };
}

async function verifyJwtToken(
  token: string,
  jwksUrl: string,
  audience: string,
  issuer: string,
): Promise<AuthenticatedUser> {
  const parsed = parseJwt(token);
  if (parsed.header.alg !== "RS256") {
    throw new Error("unsupported_algorithm");
  }
  const jwk = await selectJwk(jwksUrl, parsed.header.kid);
  if (!jwk) {
    throw new Error("jwk_not_found");
  }

  const keyObject = createPublicKey({ key: jwk, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(parsed.signingInput);
  verifier.end();
  const validSignature = verifier.verify(keyObject, parsed.signature);
  if (!validSignature) {
    throw new Error("invalid_signature");
  }

  if (!validateAudience(parsed.payload.aud, audience)) {
    throw new Error("invalid_audience");
  }
  if (parsed.payload.iss !== issuer) {
    throw new Error("invalid_issuer");
  }
  if (!validateTokenTiming(parsed.payload)) {
    throw new Error("token_not_current");
  }

  const orgId =
    extractClaim(parsed.payload, ["orgId", "org_id", "https://apgms.io/orgId", "https://apgms.io/org_id"]) ?? undefined;
  if (!orgId) {
    throw new Error("missing_org_id");
  }
  const role =
    extractClaim(parsed.payload, ["role", "https://apgms.io/role"]) ?? deriveRoleFromScope(parsed.payload.scope);

  return { orgId, role };
}

function deriveRoleFromScope(scope: DecodedJwtPayload["scope"]): string {
  if (typeof scope === "string") {
    const parts = scope.split(" ").filter(Boolean);
    if (parts.length > 0) {
      return parts[0];
    }
  }
  if (Array.isArray(scope) && typeof scope[0] === "string") {
    return scope[0];
  }
  return "user";
}

function validateAudience(aud: DecodedJwtPayload["aud"], expected: string): boolean {
  if (typeof aud === "string") {
    return aud === expected;
  }
  if (Array.isArray(aud)) {
    return aud.includes(expected);
  }
  return false;
}

function validateTokenTiming(payload: DecodedJwtPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now >= payload.exp) {
    return false;
  }
  if (typeof payload.nbf === "number" && now < payload.nbf) {
    return false;
  }
  return true;
}

async function selectJwk(jwksUrl: string, kid?: string): Promise<JsonWebKey | undefined> {
  const keys = await loadJwks(jwksUrl);
  return keys.find((key) => key.kty === "RSA" && (!kid || key.kid === kid));
}

async function loadJwks(jwksUrl: string): Promise<JsonWebKey[]> {
  const cached = jwksCache.get(jwksUrl);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }

  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`failed_to_fetch_jwks:${response.status}`);
  }
  const body = (await response.json()) as { keys?: JsonWebKey[] };
  if (!Array.isArray(body.keys)) {
    throw new Error("jwks_missing_keys");
  }
  jwksCache.set(jwksUrl, { keys: body.keys, fetchedAt: Date.now() });
  return body.keys;
}

function parseJwt(token: string): ParsedJwt {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_jwt_format");
  }
  const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8")) as DecodedJwtHeader;
  const payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8")) as DecodedJwtPayload;
  const signature = base64UrlDecode(parts[2]);
  const signingInput = `${parts[0]}.${parts[1]}`;
  return { header, payload, signature, signingInput };
}

function base64UrlDecode(segment: string): Buffer {
  let normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  if (padding > 0) {
    normalized += "=".repeat(4 - padding);
  }
  return Buffer.from(normalized, "base64");
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
  const authPreHandler = createAuthPreHandler();
  const idempotencyStore = createIdempotencyStore();

  app.register(cors, { origin: true });

  app.log.info(maskObject({ DATABASE_URL: process.env.DATABASE_URL }), "loaded env");

  app.get("/health", async () => ({ ok: true, service: "api-gateway" }));

  app.get("/users", { preHandler: authPreHandler }, async (req) => {
    const authUser = req.user!;
    const users = await prisma.user.findMany({
      select: { email: true, orgId: true, createdAt: true },
      where: { orgId: authUser.orgId },
      orderBy: { createdAt: "desc" },
    });
    return {
      users: users.map((user) => ({
        ...user,
        email: redactEmailIfNeeded(user.email, authUser.role),
      })),
    };
  });

  app.get("/bank-lines", { preHandler: authPreHandler }, async (req) => {
    const authUser = req.user!;
    const parsedQuery = bankLinesQuerySchema.parse(req.query ?? {});
    const where: Record<string, unknown> = { orgId: authUser.orgId };
    const dateFilters: Record<string, Date> = {};
    if (parsedQuery.startDate) {
      dateFilters.gte = new Date(parsedQuery.startDate);
    }
    if (parsedQuery.endDate) {
      dateFilters.lte = new Date(parsedQuery.endDate);
    }
    if (Object.keys(dateFilters).length > 0) {
      where.date = dateFilters;
    }

    const lines = await prisma.bankLine.findMany({
      where,
      orderBy: { date: "desc" },
      take: parsedQuery.take,
      skip: parsedQuery.skip,
    });
    return { lines };
  });

  app.post("/bank-lines", { preHandler: authPreHandler }, async (req, rep) => {
    const authUser = req.user!;
    const idempotencyKey = getHeaderValue(req, IDEMPOTENCY_HEADER);
    if (!idempotencyKey || idempotencyKey.length > 64) {
      return rep.code(400).send({ error: "invalid_idempotency_key" });
    }

    let payload;
    try {
      payload = createBankLineSchema.parse(req.body ?? {});
    } catch (error) {
      req.log.warn({ err: maskError(error) }, "invalid bank line payload");
      return rep.code(400).send({ error: "bad_request" });
    }

    const hashedBody = stableHashPayload(payload);
    const storeKey = `${authUser.orgId}:${idempotencyKey}`;
    const existing = idempotencyStore.get(storeKey);
    if (existing) {
      if (existing.hash !== hashedBody) {
        return rep.code(409).send({ error: "idempotency_conflict" });
      }
      return rep.code(existing.statusCode).send(existing.body);
    }

    try {
      const created = await prisma.bankLine.create({
        data: {
          orgId: authUser.orgId,
          date: new Date(payload.date),
          amount: payload.amount as any,
          payee: payload.memo ?? "N/A",
          desc: payload.memo ?? "",
        },
      });
      const responseBody = JSON.parse(JSON.stringify(created));
      idempotencyStore.set(storeKey, {
        hash: hashedBody,
        statusCode: 201,
        body: responseBody,
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
      });
      return rep.code(201).send(responseBody);
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
