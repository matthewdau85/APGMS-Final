// shared/src/idempotency.ts
import type { PrismaClient } from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { badRequest, conflict } from "./errors.js";
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
  request: { headers?: Record<string, unknown> } | null | undefined,
  _reply: unknown,
  ctx: Ctx,
  handler: (args: { idempotencyKey: string }) => Promise<T>
): Promise<T> {
  const key = normalizeKey(request, ctx);
  const requestHash = hashPayload(ctx.requestPayload ?? null);

  const existing = await ctx.prisma.idempotencyEntry.findUnique({
    where: { orgId_key: { orgId: ctx.orgId, key } },
  });
  if (existing) {
    if (existing.requestHash && existing.requestHash !== requestHash) {
      throw conflict("idempotent_payload_mismatch", "Payload differs for this idempotency key");
    }
    return {
      statusCode: existing.statusCode,
      resource: existing.resource ?? null,
      resourceId: existing.resourceId ?? null,
      body: asResponseBody(existing.responsePayload),
    } as T;
  }

  await ctx.prisma.idempotencyEntry.create({
    data: {
      key,
      orgId: ctx.orgId,
      actorId: ctx.actorId ?? "system",
      requestHash,
      responseHash: hashPayload(null),
      statusCode: 202,
      responsePayload: null,
      resource: ctx.resource ?? null,
      resourceId: null,
    },
  });

  const result = await handler({ idempotencyKey: key });

  try {
    const responsePayload: InputJsonValue | null =
      result.body === undefined ? null : (result.body as InputJsonValue);
    await ctx.prisma.idempotencyEntry.update({
      where: { orgId_key: { orgId: ctx.orgId, key } },
      data: {
        resource: result.resource ?? ctx.resource ?? null,
        resourceId: result.resourceId ?? null,
        statusCode: result.statusCode,
        responsePayload,
        responseHash: hashPayload(result.body ?? null),
      },
    });
  } catch {
    // ignore
  }

  return result;
}

function normalizeKey(
  request: { headers?: Record<string, unknown> } | null | undefined,
  ctx: Ctx,
): string {
  const headers = request?.headers ?? {};
  for (const key of ["idempotency-key", "Idempotency-Key", "IDEMPOTENCY-KEY"]) {
    const value = headers?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  if (ctx.requestPayload !== undefined) {
    return `payload:${derivePayloadDigest(ctx)}`;
  }

  throw badRequest("missing_idempotency_key", "Idempotency-Key header or request payload is required");
}

function derivePayloadDigest(ctx: Ctx): string {
  const resource = ctx.resource ?? "";
  const payloadString = safeStringify(ctx.requestPayload);
  const digestInput = `${ctx.orgId ?? ""}:${resource}:${payloadString}`;
  return createHash("sha256").update(digestInput).digest("hex");
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(safeStringify(payload)).digest("hex");
}

function asResponseBody(value: unknown): unknown {
  if (value === null) {
    return undefined;
  }
  return value;
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
