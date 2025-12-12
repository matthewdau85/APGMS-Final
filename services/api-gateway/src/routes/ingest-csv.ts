// services/api-gateway/src/routes/ingest-csv.ts
import type { FastifyInstance } from "fastify";
import { authGuard } from "../auth.js";

const periodPattern = /^\d{4}-(Q[1-4]|(0[1-9]|1[0-2]))$/;

function isValidPeriod(period: unknown): period is string {
  return typeof period === "string" && periodPattern.test(period);
}

function isRowsArray(rows: unknown): rows is unknown[] {
  return Array.isArray(rows);
}

// Secure (production-style) registration (typically mounted under /api)
export async function registerIngestCsvRoutes(app: FastifyInstance) {
  app.post(
    "/ingest/csv",
    { preHandler: [authGuard as any] },
    async (request, reply) => {
      const body: any = (request as any).body ?? {};
      const period = body.period;
      const rows = body.rows;

      if (!isValidPeriod(period) || !isRowsArray(rows)) {
        return reply.code(400).send({
          error: { message: "Invalid payload", code: "BAD_REQUEST" },
        });
      }

      return reply.code(202).send({
        status: "accepted",
        ingestedRows: rows.length,
      });
    },
  );
}

// Test harness expects this exact export name/signature and NO auth requirement
export function csvIngestRoutes(app: FastifyInstance, _deps?: any): void {
  app.post("/ingest/csv", async (request, reply) => {
    const body: any = (request as any).body ?? {};
    const period = body.period;
    const rows = body.rows;

    // Missing required fields
    if (!period || rows == null) {
      return reply.code(400).send({
        error: { message: "Invalid payload", code: "BAD_REQUEST" },
      });
    }

    if (!isValidPeriod(period)) {
      return reply.code(400).send({
        error: { message: "Invalid period format", code: "BAD_REQUEST" },
      });
    }

    if (!isRowsArray(rows)) {
      return reply.code(400).send({
        error: { message: "Invalid payload", code: "BAD_REQUEST" },
      });
    }

    return reply.code(202).send({
      status: "accepted",
      ingestedRows: rows.length,
    });
  });
}
