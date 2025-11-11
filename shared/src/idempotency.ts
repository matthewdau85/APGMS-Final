// shared/src/idempotency.ts
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { conflict } from "./errors.js";

type Ctx = {
  prisma: PrismaClient;
  orgId: string;
  actorId?: string;
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

  const key =
    typeof rawKey === "string" && rawKey.trim()
      ? rawKey.trim()
      : `auto:${cryptoSafe()}`;

  const existing = await ctx.prisma.idempotencyEntry.findUnique({
    where: { orgId_key: { orgId: ctx.orgId, key } },
    select: { id: true, key: true, orgId: true },
  });
  if (existing) throw conflict("idempotent_replay", "Request already processed");

  const requestHash = hashPayload(ctx.requestPayload);

  await ctx.prisma.idempotencyEntry.create({
    data: {
      key,
      orgId: ctx.orgId,
      actorId: ctx.actorId ?? "unknown",
      requestHash,
      responseHash: hashPayload(null),
      statusCode: 0,
      resource: ctx.resource ?? null,
      resourceId: null,
    },
  });

  const result = await handler({ idempotencyKey: key });

  try {
    const responsePayload = result.body;
    const payloadForHash = responsePayload ?? null;
    const updateData: Record<string, unknown> = {
      statusCode: result.statusCode,
      resource: result.resource ?? ctx.resource ?? null,
      resourceId: result.resourceId ?? null,
      responseHash: hashPayload(payloadForHash),
    };

    if (responsePayload !== undefined) {
      (updateData as Record<string, unknown>).responsePayload = responsePayload ?? null;
    }

    await ctx.prisma.idempotencyEntry.update({
      where: { orgId_key: { orgId: ctx.orgId, key } },
      data: updateData as any,
    });
  } catch {
    // ignore
  }

  return result;
}

function cryptoSafe(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function hashPayload(payload: unknown): string {
  try {
    const serialised = payload === undefined ? "undefined" : JSON.stringify(payload);
    return createHash("sha256").update(serialised ?? "null").digest("hex");
  } catch {
    return createHash("sha256").update(String(payload)).digest("hex");
  }
}
