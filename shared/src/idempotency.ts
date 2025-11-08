import crypto from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

export type IdempotencyContext = {
  prisma: PrismaClient;
  orgId: string;
  actorId: string;
};

export const computePayloadHash = (payload: unknown): string => {
  const json = JSON.stringify(payload ?? null);
  return crypto.createHash("sha256").update(json, "utf8").digest("hex");
};

type RegisterInput = {
  key: string;
  requestHash: string;
  statusCode: number;
  responsePayload: unknown;
  resource?: string;
  resourceId?: string;
};

export async function registerIdempotencyRecord(
  ctx: IdempotencyContext,
  input: RegisterInput,
) {
  const responseHash = computePayloadHash(input.responsePayload);
  const responsePayload =
    input.responsePayload === null || input.responsePayload === undefined
      ? Prisma.JsonNull
      : (input.responsePayload as Prisma.InputJsonValue);

  return ctx.prisma.idempotencyEntry.create({
    data: {
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      key: input.key,
      requestHash: input.requestHash,
      responseHash,
      statusCode: input.statusCode,
      responsePayload,
      resource: input.resource ?? null,
      resourceId: input.resourceId ?? null,
    },
  });
}

export async function findIdempotentResponse(
  ctx: IdempotencyContext,
  key: string,
): Promise<
  | {
      response: unknown;
      responseHash: string;
      requestHash: string;
      statusCode: number;
      actorId: string;
    }
  | null
> {
  const existing = await ctx.prisma.idempotencyEntry.findUnique({
    where: {
      orgId_key: {
        orgId: ctx.orgId,
        key,
      },
    },
  });

  if (!existing) {
    return null;
  }

  return {
    response: existing.responsePayload,
    responseHash: existing.responseHash,
    requestHash: existing.requestHash,
    statusCode: existing.statusCode,
    actorId: existing.actorId,
  };
}
