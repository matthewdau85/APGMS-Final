// services/api-gateway/src/lib/idempotency.ts
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { badRequest, conflict } from "@apgms/shared";
import type { FastifyReply } from "fastify";

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
  throw badRequest("missing_idempotency_key", "Idempotency-Key header is required");
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
  reply: FastifyReply | unknown,
  ctx: Ctx,
  handler: (args: { idempotencyKey: string }) => Promise<T>
): Promise<T> {
  const key = getIdempotencyKeyFromHeaders(request as any);
  const requestHash = hashPayload(ctx.requestPayload ?? null);

  // 1) Guard: replays return the stored response, conflicts reject
  const existing = await ctx.prisma.idempotencyEntry.findUnique({
    where: { orgId_key: { orgId: ctx.orgId, key } },
  });
  if (existing) {
    (reply as FastifyReply | undefined)?.header("Idempotent-Replay", "true");
    if (existing.requestHash !== requestHash) {
      throw conflict("idempotency_conflict", "Idempotency key reuse with different payload");
    }

    const storedPayload = existing.responsePayload ?? null;
    if (reply && typeof (reply as FastifyReply).code === "function") {
      (reply as FastifyReply)
        .code(existing.statusCode)
        .send(storedPayload === Prisma.JsonNull ? null : storedPayload);
    }
    return {
      statusCode: existing.statusCode,
      resource: existing.resource,
      resourceId: existing.resourceId ?? null,
      body: storedPayload === Prisma.JsonNull ? null : storedPayload,
    } as T;
  }

  // 2) Create the record
  await ctx.prisma.idempotencyEntry.create({
    data: {
      key,
      orgId: ctx.orgId,
      actorId: ctx.actorId ?? "system",
      requestHash,
      responseHash: hashPayload(null),
      statusCode: 202,
      responsePayload: Prisma.JsonNull,
      resource: ctx.resource ?? null,
      resourceId: null,
    },
  });

  // 3) Run the handler
  const result = await handler({ idempotencyKey: key });
  (reply as FastifyReply | undefined)?.header("Idempotent-Replay", "false");

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
