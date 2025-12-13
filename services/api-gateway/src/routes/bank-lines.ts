import type { FastifyInstance } from "fastify";
import { serviceModeHttpGuard } from "../guards/service-mode.js";

export async function bankLinesPlugin(app: FastifyInstance): Promise<void> {
  // IMPORTANT: apply to bank-lines routes only (do NOT apply to /admin/service-mode)
  app.addHook("preHandler", serviceModeHttpGuard());

  app.get("/bank-lines", async (_req, reply) => {
    // Example read endpoint (allowed in read-only)
    return reply.code(200).send({ items: [] });
  });

  app.post("/bank-lines", async (_req, reply) => {
    // Example write endpoint (blocked in read-only and suspended)
    return reply.code(201).send({ ok: true });
  });
}

export function createBankLinesPlugin(_deps: any) {
  return bankLinesPlugin;
}
