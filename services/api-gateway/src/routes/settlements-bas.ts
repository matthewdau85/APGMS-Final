import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";

type IdempotencyRecord = {
  key: string;
  requestBody: unknown;
  statusCode: number;
  responseBody: unknown;
};

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    ak.sort();
    bk.sort();
    for (let i = 0; i < ak.length; i++) {
      if (ak[i] !== bk[i]) return false;
      if (!deepEqual(a[ak[i]], b[bk[i]])) return false;
    }
    return true;
  }
  return false;
}

function parseUserFromAuthHeader(authHeader: string | undefined) {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : "";
  if (!token) return null;
  return { token };
}

export const settlementsBasRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const store: Map<string, IdempotencyRecord> =
    (app as any).idempotencyStore || new Map<string, IdempotencyRecord>();

  (app as any).idempotencyStore = store;

  app.post("/api/settlements/bas", async (req, reply) => {
    const user = parseUserFromAuthHeader(req.headers.authorization as any);
    if (!user) {
      reply.code(401);
      return { error: "unauthorized" };
    }

    const idemKeyRaw = (req.headers["idempotency-key"] || req.headers["Idempotency-Key"]) as any;
    const idempotencyKey = typeof idemKeyRaw === "string" ? idemKeyRaw.trim() : "";
    if (!idempotencyKey) {
      reply.code(400);
      return { error: "idempotency_key_required" };
    }

    const body = (req as any).body || {};
    const storeKey = `${user.token}:${idempotencyKey}`;

    const existing = store.get(storeKey);
    if (existing) {
      if (!deepEqual(existing.requestBody, body)) {
        reply.code(409);
        return { error: "idempotency_key_conflict" };
      }
      reply.code(existing.statusCode);
      return existing.responseBody;
    }

    const period = typeof (body as any).period === "string" ? (body as any).period : "unknown";
    const responseBody = {
      instructionId: randomUUID(),
      period,
      status: "CREATED",
    };

    const rec: IdempotencyRecord = {
      key: storeKey,
      requestBody: body,
      statusCode: 201,
      responseBody,
    };

    store.set(storeKey, rec);

    reply.code(201);
    return responseBody;
  });
};
