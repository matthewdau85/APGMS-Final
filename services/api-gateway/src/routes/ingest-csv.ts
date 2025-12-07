import { FastifyInstance, FastifyPluginOptions } from "fastify";

export async function csvIngestRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.post("/ingest/csv", {
    // future: file upload handling
  }, async (req, reply) => {
    return {
      status: "accepted",
      // later: parse + push into bank-lines / obligations
      message: "CSV accepted for processing",
    };
  });
}
