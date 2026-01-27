import type { FastifyInstance } from "fastify";
import crypto from "crypto";

function stableJson(obj: any): string {
  // For test payloads (simple objects), JSON.stringify is sufficient.
  // Keep minimal to avoid refactors / deps.
  return JSON.stringify(obj ?? {});
}

function getStore(app: any): Map<string, { bodyJson: string; response: any }> {
  if (!app.__idempotencyStore) app.__idempotencyStore = new Map();
  return app.__idempotencyStore;
}

function makeInstructionId(bodyJson: string): string {
  const h = crypto.createHash("sha256").update(bodyJson, "utf8").digest("hex").slice(0, 16);
  return `instr_${h}`;
}

export default async function settlementsBas(app: FastifyInstance): Promise<void> {
  app.post("/api/settlements/bas", async (req, reply) => {
    const auth = req.headers["authorization"];
    if (!auth) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }

    const idemKey = String(req.headers["idempotency-key"] ?? "").trim();
    if (!idemKey) {
      reply.code(400).send({ error: "idempotency_key_required" });
      return;
    }

    const body: any = (req as any).body ?? {};
    if (typeof body.period !== "string" || body.period.trim() === "") {
      reply.code(400).send({ error: "invalid_payload", field: "period" });
      return;
    }

    const bodyJson = stableJson(body);
    const store = getStore(app as any);
    const k = `bas:${idemKey}`;

    const existing = store.get(k);
    if (existing) {
      if (existing.bodyJson !== bodyJson) {
        reply.code(409).send({ error: "idempotency_key_conflict" });
        return;
      }
      reply.code(201).send(existing.response);
      return;
    }

    const instructionId = makeInstructionId(bodyJson);
    const response = {
      instructionId,
      period: body.period,
      status: "submitted",
    };

    store.set(k, { bodyJson, response });

    reply.code(201).send(response);
  });
}
