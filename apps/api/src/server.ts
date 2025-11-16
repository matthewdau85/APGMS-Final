import Fastify from "fastify";
import { registerPaymentPlanRoutes } from "./routes/paymentPlans.js";
import { registerForecastRoutes } from "./routes/forecasting.js";

const server = Fastify({ logger: true });

await server.register(registerPaymentPlanRoutes, { prefix: "/payment-plans" });
await server.register(registerForecastRoutes, { prefix: "/forecasting" });

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

server.listen({ port, host }).catch((err) => {
  server.log.error(err, "Failed to start API");
  process.exit(1);
});
