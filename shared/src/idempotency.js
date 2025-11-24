import { badRequest, conflict } from "./errors.js";
import { createHash } from "node:crypto";
export async function withIdempotency(request, _reply, ctx, handler) {
    const rawKey = request?.headers?.["idempotency-key"] ??
        request?.headers?.["Idempotency-Key"] ??
        request?.headers?.["IDEMPOTENCY-KEY"];
    const key = normalizeKey(rawKey, ctx);
    const existing = await ctx.prisma.idempotencyKey.findUnique({
        where: { orgId_key: { orgId: ctx.orgId, key } },
        select: { id: true, key: true, orgId: true, firstSeenAt: true },
    });
    if (existing)
        throw conflict("idempotent_replay", "Request already processed");
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
    }
    catch {
        // ignore
    }
    return result;
}
function normalizeKey(rawKey, ctx) {
    const headerKey = typeof rawKey === "string" ? rawKey.trim() : "";
    if (headerKey.length > 0) {
        return headerKey;
    }
    if (ctx.requestPayload !== undefined) {
        return `payload:${derivePayloadDigest(ctx)}`;
    }
    throw badRequest("missing_idempotency_key", "Idempotency-Key header or request payload is required");
}
function derivePayloadDigest(ctx) {
    const resource = ctx.resource ?? "";
    const payloadString = safeStringify(ctx.requestPayload);
    const digestInput = `${ctx.orgId ?? ""}:${resource}:${payloadString}`;
    return createHash("sha256").update(digestInput).digest("hex");
}
function safeStringify(value) {
    if (typeof value === "string") {
        return value;
    }
    if (value === undefined) {
        return "";
    }
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
