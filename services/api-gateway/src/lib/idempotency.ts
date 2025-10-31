
import type { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import {
  badRequest,
  conflict,
  computePayloadHash,
  findIdempotentResponse,
  registerIdempotencyRecord,
  type IdempotencyContext,
} from "@apgms/shared";

export type IdempotentHandlerResult = {
  statusCode: number;
  body: unknown;
  resource?: string;
  resourceId?: string;
};

export type IdempotentHandler = (args: {
  idempotencyKey: string;
}) => Promise<IdempotentHandlerResult>;

type WithIdempotencyOptions = {
  prisma: IdempotencyContext["prisma"];
  orgId: string;
  actorId: string;
  requestPayload?: unknown;
  resource?: string;
};

export async function withIdempotency(
  request: FastifyRequest,
  reply: FastifyReply,
  options: WithIdempotencyOptions,
  handler: IdempotentHandler,
) {
  const rawHeader = request.headers["idempotency-key"];
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const idempotencyKey = headerValue?.trim();

  if (!idempotencyKey) {
    throw badRequest("missing_idempotency_key", "Idempotency-Key header is required");
  }

  const ctx: IdempotencyContext = {
    prisma: options.prisma,
    orgId: options.orgId,
    actorId: options.actorId,
  };

  const payload = options.requestPayload ?? request.body ?? null;
  const requestHash = computePayloadHash(payload);

  const existing = await findIdempotentResponse(ctx, idempotencyKey);
  if (existing) {
    if (existing.actorId !== options.actorId || existing.requestHash !== requestHash) {
      throw conflict(
        "idempotency_conflict",
        "Idempotency key re-used with different payload or actor context",
      );
    }

    reply.header("Idempotent-Replay", "true");
    reply.status(existing.statusCode).send(existing.response);
    return { replayed: true, body: existing.response };
  }

  const result = await handler({ idempotencyKey });

  try {
    await registerIdempotencyRecord(ctx, {
      key: idempotencyKey,
      requestHash,
      statusCode: result.statusCode,
      responsePayload: result.body,
      resource: result.resource,
      resourceId: result.resourceId,
    });
  } catch (error) {
    if ((error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || (error as any)?.code === "P2002") {
      const latest = await findIdempotentResponse(ctx, idempotencyKey);
      if (latest && latest.actorId === options.actorId && latest.requestHash === requestHash) {
        reply.header("Idempotent-Replay", "true");
        reply.status(latest.statusCode).send(latest.response);
        return { replayed: true, body: latest.response };
      }
      throw conflict(
        "idempotency_conflict",
        "Idempotency key already used with a different payload",
      );
    }
    throw error;
  }

  reply.header("Idempotent-Replay", "false");
  reply.status(result.statusCode).send(result.body);
  return { replayed: false, body: result.body };
}
