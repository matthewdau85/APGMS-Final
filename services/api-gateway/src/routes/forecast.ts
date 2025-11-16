// services/api-gateway/src/routes/forecast.ts
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { forecastObligation } from "@apgms/forecasting";

type ObligationType = "PAYGW" | "GST" | "PAYGI";

export async function registerForecastRoutes(app: FastifyInstance): Promise<void> {
  app.get("/forecast", async (request, reply) => {
    const user = request.user;
    if (!user?.orgId) {
      reply.code(401).send({ error: { code: "unauthorized" } });
      return;
    }

    const history = await prisma.obligationHistory.findMany({
      where: { orgId: user.orgId },
      orderBy: { date: "asc" },
    });

    const toPoints = (type: ObligationType) =>
      history
        .filter((entry) => entry.type === type)
        .map((entry) => ({ date: entry.date, value: entry.amountCents / 100 }));

    const paygwForecast = forecastObligation(toPoints("PAYGW"));
    const gstForecast = forecastObligation(toPoints("GST"));
    const paygiForecast = forecastObligation(toPoints("PAYGI"));

    reply.send({
      paygw: paygwForecast,
      gst: gstForecast,
      paygi: paygiForecast,
    });
  });
}
