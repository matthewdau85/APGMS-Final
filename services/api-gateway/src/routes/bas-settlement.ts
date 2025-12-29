import { type FastifyPluginAsync } from "fastify";
import { stableId } from "../lib/safe-math.js";
import { getServiceMode } from "../service-mode.js";

/* ---------------- Utilities ---------------- */

function isValidPeriod(period: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(period);
}

function enforceServiceMode() {
  const mode = getServiceMode();
  if (mode?.mode === "suspended") {
    return { code: 503, error: "service_suspended" };
  }
  if (mode?.mode === "read-only") {
    return { code: 409, error: "service_read_only" };
  }
  return null;
}

/* ---------------- In-memory store ---------------- */

type Settlement = {
  instructionId: string;
  period: string;
  payload?: any;
  status: "PREPARED" | "SENT" | "ACK" | "FAILED";
};

const settlements = new Map<string, Settlement>();

/* ---------------- Plugin ---------------- */

export const basSettlementPlugin: FastifyPluginAsync = async (app) => {
  /* -------- prepare -------- */
  app.post("/settlements/bas/prepare", async (req, reply) => {
    const guard = enforceServiceMode();
    if (guard) return reply.code(guard.code).send({ error: guard.error });

    const body: any = req.body ?? {};
    const period = String(body.period ?? "");

    if (!isValidPeriod(period)) {
      return reply.code(400).send({ error: "invalid_period" });
    }

    const instructionId = stableId("bas");
    const settlement: Settlement = {
      instructionId,
      period,
      payload: body.payload,
      status: "PREPARED",
    };

    settlements.set(instructionId, settlement);

    return reply.code(201).send({
      instructionId,
      period,
      payload: body.payload,
    });
  });

  /* -------- sent -------- */
  app.post("/settlements/bas/:id/sent", async (req, reply) => {
    const s = settlements.get((req.params as any).id);
    if (!s) return reply.code(404).send({ error: "not_found" });

    s.status = "SENT";
    return reply.send({ instructionId: s.instructionId, status: "SENT" });
  });

  /* -------- ack -------- */
  app.post("/settlements/bas/:id/ack", async (req, reply) => {
    const s = settlements.get((req.params as any).id);
    if (!s) return reply.code(404).send({ error: "not_found" });

    s.status = "ACK";
    return reply.send({ instructionId: s.instructionId, status: "ACK" });
  });

  /* -------- failed -------- */
  app.post("/settlements/bas/:id/failed", async (req, reply) => {
    const s = settlements.get((req.params as any).id);
    if (!s) return reply.code(404).send({ error: "not_found" });

    s.status = "FAILED";
    return reply.send({ instructionId: s.instructionId, status: "FAILED" });
  });

  /* -------- finalise (auth & non-auth mounts) -------- */
  app.post("/settlements/bas/finalise", async (req, reply) => {
    const guard = enforceServiceMode();
    if (guard) return reply.code(guard.code).send({ error: guard.error });

    const body: any = req.body ?? {};
    const period = String(body.period ?? "");

    if (!isValidPeriod(period)) {
      return reply.code(400).send({ error: "invalid_period" });
    }

    const instructionId = stableId("bas");

    return reply.code(201).send({
      instructionId,
      period,
      payload: body.payload,
    });
  });
};

export default basSettlementPlugin;

/* ---------------- Compatibility exports ---------------- */

export const basSettlementRoutes = basSettlementPlugin;
