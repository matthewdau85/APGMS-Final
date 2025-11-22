// services/api-gateway/src/routes/forecast.ts

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
} from "fastify";
import type { PrismaClient } from "@prisma/client";

type ForecastQuery = {
  orgId: string;
};

export const registerForecastRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
): Promise<void> => {
  const prisma = (app as any).prisma as PrismaClient;

  app.get(
    "/forecast/obligations",
    async (request: FastifyRequest<{ Querystring: ForecastQuery }>, reply) => {
      const { orgId } = request.query;

      const db: any = prisma as any;

      const history =
        (db.obligationHistory?.findMany
          ? await db.obligationHistory.findMany({
              where: { orgId },
              orderBy: { periodStart: "asc" },
            })
          : []) ?? [];

      const samples = history.map((h: any) => ({
        orgId: h.orgId,
        periodStart: h.periodStart,
        periodEnd: h.periodEnd,
        amount: Number(h.amount ?? 0),
        taxType: h.taxType ?? "UNKNOWN",
      }));

      return reply.send({ samples });
    },
  );
};
