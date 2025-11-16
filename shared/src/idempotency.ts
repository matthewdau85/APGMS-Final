// shared/src/idempotency.ts
import type { PrismaClient } from "@prisma/client";
import { catalogError } from "./errors/catalog.js";
import { createHash } from "node:crypto";

type Ctx = {
  prisma: PrismaClient;
  orgId: string;
  actorId?: string;        // not persisted
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

  const existing = await ctx.prisma.idempotencyKey.findUnique({
    where: { orgId_key: { orgId: ctx.orgId, key } },
    select: { id: true, key: true, orgId: true, firstSeenAt: true },
  });
  if (existing) throw catalogError("platform.idempotency_conflict");

  await ctx.prisma.idempotencyKey.create({
    data: {
      key,
      orgId: ctx.orgId,
      resource: ctx.resource ?? null,
      resourceId: null,
    },
  });

  const result = await handler({ idempotencyKey: key });

  try {
    await ctx.prisma.idempotencyKey.update({
      where: { orgId_key: { orgId: ctx.orgId, key } },
      data: {
        resource: result.resource ?? ctx.resource ?? null,
        resourceId: result.resourceId ?? null,
      },
    });
  } catch {
    // ignore
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

  throw catalogError("platform.idempotency_key_missing");
}

function derivePayloadDigest(ctx: Ctx): string {
  const resource = ctx.resource ?? "";
  const payloadString = safeStringify(ctx.requestPayload);
  const digestInput = `${ctx.orgId ?? ""}:${resource}:${payloadString}`;
  return createHash("sha256").update(digestInput).digest("hex");
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
