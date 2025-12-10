import type { PrismaClient } from "@prisma/client";
type Ctx = {
    prisma: PrismaClient;
    orgId: string;
    actorId?: string;
    requestPayload?: any;
    resource?: string | null;
};
type HandlerResult = {
    statusCode: number;
    resource?: string | null;
    resourceId?: string | null;
    body?: any;
};
export declare function withIdempotency<T extends HandlerResult>(request: {
    headers?: Record<string, any>;
}, _reply: any, ctx: Ctx, handler: (args: {
    idempotencyKey: string;
}) => Promise<T>): Promise<T>;
export {};
//# sourceMappingURL=idempotency.d.ts.map