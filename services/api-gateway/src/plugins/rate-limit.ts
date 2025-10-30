import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import { config } from "../config.js";

export default fp(async (app) => {
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
    redis: null,
    allowList: (req) => {
      const url = req.raw.url ?? "";
      return (
        url.startsWith("/health") ||
        url.startsWith("/ready") ||
        url.startsWith("/metrics")
      );
    },
  });
});
