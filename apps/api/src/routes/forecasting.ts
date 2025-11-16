import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@apgms/shared/db.js";
import {
  captureForecastSnapshot,
  listForecastSnapshots,
  latestForecastSnapshot,
} from "@apgms/forecasting";

const captureSchema = z.object({
  orgId: z.string(),
  lookback: z.number().int().positive().max(12).optional(),
  alpha: z.number().min(0).max(1).optional(),
  method: z.string().optional(),
});

export async function registerForecastRoutes(app: FastifyInstance) {
  app.get("/snapshots", async (request, reply) => {
    const { orgId } = request.query as { orgId?: string };
    if (!orgId) {
      reply.code(400).send({ error: "orgId_required" });
      return;
    }
    const snapshots = await listForecastSnapshots(prisma, orgId);
    reply.send({ snapshots });
  });

  app.get("/snapshots/latest", async (request, reply) => {
    const { orgId } = request.query as { orgId?: string };
    if (!orgId) {
      reply.code(400).send({ error: "orgId_required" });
      return;
    }
    const snapshot = await latestForecastSnapshot(prisma, orgId);
    reply.send({ snapshot });
  });

  app.post("/snapshots", async (request, reply) => {
    const payload = captureSchema.parse(request.body);
    const result = await captureForecastSnapshot(prisma, payload.orgId, {
      lookback: payload.lookback,
      alpha: payload.alpha,
      method: payload.method,
    });
    reply.code(201).send(result);
  });
}
