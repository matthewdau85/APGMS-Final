import type { PrismaClient } from "@prisma/client";
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
/**
 * Wrap a route handler with idempotency.
 * Prisma model uses: @@unique([orgId, key], name: "orgId_key")
 */
export declare function withIdempotency<T extends HandlerResult>(request: unknown, _reply: unknown, ctx: Ctx, handler: (args: {
    idempotencyKey: string;
}) => Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=idempotency.d.ts.map