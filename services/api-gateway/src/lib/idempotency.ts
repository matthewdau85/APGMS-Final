// services/api-gateway/src/lib/idempotency.ts
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { conflict } from "@apgms/shared";

type Ctx = {
  prisma: PrismaClient;
  orgId: string;
  actorId?: string;          // not persisted
  requestPayload?: unknown;  // not persisted
  resource?: string | null;
};

type HandlerResult = {
  statusCode: number;
  resource?: string | null;
  resourceId?: string | null;
  body?: unknown;
};

function getIdempotencyKeyFromHeaders(req: any): string {
  const h = (req?.headers ?? {}) as Record<string, unknown>;
  for (const k of ["idempotency-key", "Idempotency-Key", "IDEMPOTENCY-KEY"]) {
    const v = h[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return `auto:${cryptoSafe()}`;
}

function cryptoSafe(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function hashPayload(payload: unknown): string {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload ?? null);
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Wrap a route handler with idempotency.
 * Prisma model uses: @@unique([orgId, key], name: "orgId_key")
 */
export async function withIdempotency<T extends HandlerResult>(
  request: unknown,
  _reply: unknown,
  ctx: Ctx,
  handler: (args: { idempotencyKey: string }) => Promise<T>
): Promise<T> {
  const key = getIdempotencyKeyFromHeaders(request as any);

  // 1) Guard: fail if key already seen for this org
  const existing = await ctx.prisma.idempotencyEntry.findUnique({
    where: { orgId_key: { orgId: ctx.orgId, key } },
    select: { id: true },
  });
  if (existing) {
    throw conflict("idempotent_replay", "Request already processed");
  }

  // 2) Create the record
  await ctx.prisma.idempotencyEntry.create({
    data: {
      key,
      orgId: ctx.orgId,
      actorId: ctx.actorId ?? "system",
      requestHash: hashPayload(ctx.requestPayload ?? null),
      responseHash: hashPayload(null),
      statusCode: 202,
      responsePayload: Prisma.JsonNull,
      resource: ctx.resource ?? null,
      resourceId: null,
    },
  });

  // 3) Run the handler
  const result = await handler({ idempotencyKey: key });

  // 4) Best-effort update (resource/resourceId)
  try {
    const responsePayload =
      result.body === undefined ? Prisma.JsonNull : (result.body as Prisma.InputJsonValue | typeof Prisma.JsonNull);

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
