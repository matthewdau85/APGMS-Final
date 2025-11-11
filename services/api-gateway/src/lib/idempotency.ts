// services/api-gateway/src/lib/idempotency.ts
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { conflict } from "@apgms/shared";

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
    select: { id: true, key: true, orgId: true },
  });
  if (existing) {
    throw conflict("idempotent_replay", "Request already processed");
  }

  const requestHash = hashPayload(ctx.requestPayload);

  // 2) Create the record
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

  // 3) Run the handler
  const result = await handler({ idempotencyKey: key });

  // 4) Best-effort update (resource/resourceId)
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

function hashPayload(payload: unknown): string {
  try {
    const serialised = payload === undefined ? "undefined" : JSON.stringify(payload);
    return createHash("sha256").update(serialised ?? "null").digest("hex");
  } catch {
    return createHash("sha256").update(String(payload)).digest("hex");
  }
}
