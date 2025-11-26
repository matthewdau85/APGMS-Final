// shared/src/idempotency.ts
import type { PrismaClient, Prisma } from "@prisma/client";
import { badRequest, conflict } from "./errors.js";
import { createHash } from "node:crypto";

type Ctx = {
  prisma: PrismaClient;
  orgId: string;
  actorId?: string;        // optional, will default to "system" for persistence
  requestPayload?: unknown;
  resource?: string | null;
};

type HandlerResult = {
  statusCode: number;
  resource?: string | null;
  resourceId?: string | null;
  body?: unknown;
};

export async function withIdempotency<T extends HandlerResult>(
  request: { headers?: Record<string, unknown> },
  _reply: unknown,
  ctx: Ctx,
  handler: (args: { idempotencyKey: string }) => Promise<T>
): Promise<T> {
  const rawKey =
    request?.headers?.["idempotency-key"] ??
    request?.headers?.["Idempotency-Key"] ??
    request?.headers?.["IDEMPOTENCY-KEY"];

  const key = normalizeKey(rawKey, ctx);

  // If an entry already exists for this (orgId, key) pair, we treat it as a replay.
  const existing = await ctx.prisma.idempotencyEntry.findUnique({
    where: {
      orgId_key: {
        orgId: ctx.orgId,
        key,
      },
    },
  });

  if (existing) {
    throw conflict("idempotent_replay", "Request already processed");
  }

  const requestHash = deriveRequestHash(ctx, key);

  // Create the shell entry before executing the handler so that concurrent
  // requests with the same key will hit the replay branch above.
  await ctx.prisma.idempotencyEntry.create({
    data: {
      orgId: ctx.orgId,
      actorId: ctx.actorId ?? "system",
      key,
      requestHash,
      // Will be updated once we have a response; keep a stable non-empty string.
      responseHash: "",
      statusCode: 0,
      resource: ctx.resource ?? null,
      resourceId: null,
    },
  });

  const result = await handler({ idempotencyKey: key });

  try {
    const responsePayload =
      result.body !== undefined
        ? (result.body as Prisma.InputJsonValue)
        : undefined;

    const responseHash =
      result.body !== undefined ? hashJson(result.body) : "";

    await ctx.prisma.idempotencyEntry.update({
      where: {
        orgId_key: {
          orgId: ctx.orgId,
          key,
        },
      },
      data: {
        statusCode: result.statusCode,
        responseHash,
        responsePayload,
        resource: result.resource ?? ctx.resource ?? null,
        resourceId: result.resourceId ?? null,
      },
    });
  } catch {
    // idempotency entry is best-effort; failures here must not break the handler
  }

  return result;
}

function normalizeKey(rawKey: unknown, ctx: Ctx): string {
  const headerKey = typeof rawKey === "string" ? rawKey.trim() : "";
  if (headerKey.length > 0) {
    return headerKey;
  }

  if (ctx.requestPayload !== undefined) {
    return `payload:${derivePayloadDigest(ctx)}`;
  }

  throw badRequest(
    "missing_idempotency_key",
    "Idempotency-Key header or request payload is required"
  );
}

function deriveRequestHash(ctx: Ctx, key: string): string {
  // Prefer a stable digest of the payload if we have one; otherwise fall back to the key.
  if (ctx.requestPayload !== undefined) {
    return derivePayloadDigest(ctx);
  }
  return createHash("sha256").update(key).digest("hex");
}

function derivePayloadDigest(ctx: Ctx): string {
  const resource = ctx.resource ?? "";
  const payloadString = safeStringify(ctx.requestPayload);
  const digestInput = `${ctx.orgId ?? ""}:${resource}:${payloadString}`;
  return createHash("sha256").update(digestInput).digest("hex");
}

function hashJson(value: unknown): string {
  const payloadString = safeStringify(value);
  return createHash("sha256").update(payloadString).digest("hex");
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
