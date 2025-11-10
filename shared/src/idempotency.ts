// shared/src/idempotency.ts
import type { PrismaClient } from "@prisma/client";
import { conflict } from "./errors.js";

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

  const key =
    typeof rawKey === "string" && rawKey.trim()
      ? rawKey.trim()
      : `auto:${cryptoSafe()}`;

  const existing = await ctx.prisma.idempotencyKey.findUnique({
    where: { orgId_key: { orgId: ctx.orgId, key } },
    select: { id: true, key: true, orgId: true, firstSeenAt: true },
  });
  if (existing) throw conflict("idempotent_replay", "Request already processed");

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

function cryptoSafe(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}
