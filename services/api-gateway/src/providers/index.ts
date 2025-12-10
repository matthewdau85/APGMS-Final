// services/api-gateway/src/providers/index.ts
import type { FastifyBaseLogger } from "fastify";

export async function initProviders(_log: FastifyBaseLogger) {
  return {}; // TODO: add db, redis, etc.
}

export async function closeProviders(_providers: any, _log: FastifyBaseLogger) {
  return;
}
