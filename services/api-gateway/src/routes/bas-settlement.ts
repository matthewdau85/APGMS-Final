import type { FastifyInstance } from "fastify";
import { requireWritesEnabled } from "../guards/service-mode.js";
import crypto from "node:crypto";

// --------------------
// Idempotency helpers
// --------------------
type IdempotentResponse = { statusCode: number; body: any };

type IdempotencyEntry = {
  requestHash: string;
  result?: IdempotentResponse;
  inFlight?: Promise<IdempotentResponse>;
  createdAtMs: number;
};

const IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function stableStringify(value: any): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${entries.join(",")}}`;
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function hashFinaliseRequest(orgScope: string, body: unknown): string {
  return sha256Hex(stableStringify({ orgScope, body }));
}

function getHeader(req: any, name: string): string {
  const key = name.toLowerCase();
  const v = req?.headers?.[key];
  return typeof v === "string" ? v : Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
}

function getFinaliseIdempotencyStore(app: FastifyInstance): Map<string, IdempotencyEntry> {
  const anyApp = app as any;
  if (!anyApp.__basFinaliseIdempotency) {
    anyApp.__basFinaliseIdempotency = new Map<string, IdempotencyEntry>();
  }
  return anyApp.__basFinaliseIdempotency as Map<string, IdempotencyEntry>;
}

function pruneIdempotency(store: Map<string, IdempotencyEntry>, now = Date.now()) {
  for (const [k, v] of store.entries()) {
    if (now - v.createdAtMs > IDEMPOTENCY_TTL_MS) store.delete(k);
  }
}

async function runIdempotent(
  store: Map<string, IdempotencyEntry>,
  key: string,
  requestHash: string,
  fn: () => Promise<IdempotentResponse>
): Promise<IdempotentResponse | { conflict: true }> {
  pruneIdempotency(store);

  const existing = store.get(key);

  // Completed
  if (existing?.result) {
    if (existing.requestHash !== requestHash) return { conflict: true };
    return existing.result;
  }

  // In-flight
  if (existing?.inFlight) {
    if (existing.requestHash !== requestHash) return { conflict: true };
    return await existing.inFlight;
  }

  // Start new in-flight
  const inFlight = (async () => await fn())();

  store.set(key, {
    requestHash,
    inFlight,
    createdAtMs: Date.now(),
  });

  try {
    const res = await inFlight;
    store.set(key, {
      requestHash,
      result: res,
      createdAtMs: Date.now(),
    });
    return res;
  } catch (e) {
    store.delete(key);
    throw e;
  }
}

// --------------------
// BAS settlement routes
// --------------------
type SettlementStatus = "PREPARED" | "SENT" | "ACK" | "FAILED";

export interface BasSettlement {
  instructionId: string;
  period: string;
  status: SettlementStatus;
  payload?: unknown;
}

interface BasPrepareBody {
  period: string;
  payload?: unknown;
}

interface BasFinaliseBody {
  period: string;
  payload?: unknown;
}

interface BasFailedBody {
  reason?: string;
}

const periodPattern = /^(19|20)\d{2}-Q[1-4]$/;

function isValidPeriod(p: unknown): p is string {
  return typeof p === "string" && periodPattern.test(p);
}

function getBasState(app: FastifyInstance): {
  store: Map<string, BasSettlement>;
  counter: { value: number };
} {
  const anyApp = app as any;

  if (!anyApp.__basSettlementStore) {
    anyApp.__basSettlementStore = new Map<string, BasSettlement>();
  }
  if (!anyApp.__basSettlementCounter) {
    anyApp.__basSettlementCounter = { value: 0 };
  }

  return {
    store: anyApp.__basSettlementStore as Map<string, BasSettlement>,
    counter: anyApp.__basSettlementCounter as { value: number },
  };
}

function nextInstructionId(app: FastifyInstance): string {
  const state = getBasState(app);
  state.counter.value += 1;
  return `settlement-${state.counter.value}`;
}

function attachOrReplaceSettlement(app: FastifyInstance, settlement: BasSettlement): void {
  const state = getBasState(app);
  state.store.set(settlement.instructionId, settlement);
}

function getSettlement(app: FastifyInstance, instructionId: string): BasSettlement | null {
  const state = getBasState(app);
  return state.store.get(instructionId) ?? null;
}

export async function basSettlementRoutes(app: FastifyInstance): Promise<void> {
  const writeGuard = requireWritesEnabled();

  app.post<{ Body: BasFinaliseBody }>(
    "/settlements/bas/finalise",
    {
      preHandler: writeGuard,
      schema: {
        headers: {
          type: "object",
          required: ["idempotency-key"],
          properties: {
            "idempotency-key": { type: "string", minLength: 1 },
          },
          additionalProperties: true,
        },
        body: {
          type: "object",
          required: ["period"],
          additionalProperties: true,
          properties: {
            period: { type: "string", pattern: periodPattern.source },
          },
        },
      },
    },
    async (request, reply) => {
      const idemKey = String(getHeader(request, "idempotency-key") ?? "").trim();
      if (!idemKey) {
        return reply.code(400).send({ error: "missing_idempotency_key" });
      }

      const orgScope =
        String(getHeader(request, "x-org-id") ?? "").trim() ||
        String((request as any).user?.orgId ?? "").trim() ||
        "unknown";

      const scopedKey = `${orgScope}:${idemKey}`;
      const requestHash = hashFinaliseRequest(orgScope, request.body);

      const { period, payload } = request.body;

      if (!isValidPeriod(period)) {
        return reply.code(400).send({ error: "INVALID_PERIOD" });
      }

      const store = getFinaliseIdempotencyStore(app);

      const out = await runIdempotent(store, scopedKey, requestHash, async () => {
        // ---- EXISTING SIDE EFFECTS MUST LIVE INSIDE THIS FN ----
        const instructionId = nextInstructionId(app);

        const settlement: BasSettlement = {
          instructionId,
          period,
          status: "PREPARED",
          payload,
        };

        attachOrReplaceSettlement(app, settlement);

        return {
          statusCode: 201,
          body: { instructionId, period, payload },
        };
      });

      if ("conflict" in out) {
        return reply.code(409).send({ error: "idempotency_conflict" });
      }

      return reply.code(out.statusCode).send(out.body);
    }
  );
}

/**
 * Lifecycle endpoints (prepare -> sent/ack/failed).
 * These use an in-memory store keyed per Fastify instance.
 */
async function basSettlementLifecycleRoutes(app: FastifyInstance): Promise<void> {
  const writeGuard = requireWritesEnabled();

  app.post<{ Body: BasPrepareBody }>(
    "/settlements/bas/prepare",
    {
      preHandler: writeGuard,
      schema: {
        body: {
          type: "object",
          required: ["period"],
          additionalProperties: true,
          properties: {
            period: { type: "string", pattern: periodPattern.source },
          },
        },
      },
    },
    async (request, reply) => {
      const { period, payload } = request.body;

      if (!isValidPeriod(period)) {
        return reply.code(400).send({ error: "INVALID_PERIOD" });
      }

      const instructionId = nextInstructionId(app);

      const settlement: BasSettlement = {
        instructionId,
        period,
        status: "PREPARED",
        payload,
      };

      attachOrReplaceSettlement(app, settlement);

      return reply.code(201).send({ instructionId, period, payload });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/settlements/bas/:instructionId/sent",
    { preHandler: writeGuard },
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "NOT_FOUND" });

      s.status = "SENT";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/settlements/bas/:instructionId/ack",
    { preHandler: writeGuard },
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "NOT_FOUND" });

      s.status = "ACK";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );

  app.post<{ Params: { instructionId: string }; Body: BasFailedBody }>(
    "/settlements/bas/:instructionId/failed",
    { preHandler: writeGuard },
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "NOT_FOUND" });

      s.status = "FAILED";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );
}

/**
 * Legacy endpoints preserved for backward compatibility.
 * These are intentionally looser (no schema) but still enforce period format checks.
 */
async function legacyBasSettlementRoutes(app: FastifyInstance): Promise<void> {
  const writeGuard = requireWritesEnabled();

  app.post<{ Body: BasPrepareBody }>(
    "/bas-settlement/prepare",
    { preHandler: writeGuard },
    async (request, reply) => {
      const { period, payload } = request.body;

      if (!isValidPeriod(period)) {
        return reply.code(400).send({ error: "INVALID_PERIOD" });
      }

      const instructionId = nextInstructionId(app);

      const settlement: BasSettlement = {
        instructionId,
        period,
        status: "PREPARED",
        payload,
      };

      attachOrReplaceSettlement(app, settlement);

      return reply.code(201).send({ instructionId, period, payload });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/bas-settlement/:instructionId/sent",
    { preHandler: writeGuard },
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "NOT_FOUND" });

      s.status = "SENT";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/bas-settlement/:instructionId/ack",
    { preHandler: writeGuard },
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "NOT_FOUND" });

      s.status = "ACK";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );

  app.post<{ Params: { instructionId: string }; Body: BasFailedBody }>(
    "/bas-settlement/:instructionId/failed",
    { preHandler: writeGuard },
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "NOT_FOUND" });

      s.status = "FAILED";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );
}

/**
 * Plugin used by the real app (registered inside the secure scope).
 * When mounted under /api, endpoints become /api/settlements/bas/*.
 */
export async function basSettlementPlugin(app: FastifyInstance): Promise<void> {
  await basSettlementRoutes(app);
  await basSettlementLifecycleRoutes(app);
  await legacyBasSettlementRoutes(app);
}
