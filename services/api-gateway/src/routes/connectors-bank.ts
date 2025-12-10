// services/api-gateway/src/routes/connectors-bank.ts

import type { FastifyInstance, FastifyPluginAsync } from "fastify";

export const registerBankLinesRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  // Stub – extend later with real ingestion endpoints
  app.get("/bank-lines", async () => ({
    supported: true,
  }));
};

export default registerBankLinesRoutes;
