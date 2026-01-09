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

function stableStringify(value: unknown): string {
  if (value === null) return "null";

  const t = typeof value;

  if (t === "string") return JSON.stringify(value);
  if (t === "number") return Number.isFinite(value as number) ? String(value) : "null";
  if (t === "boolean") return value ? "true" : "false";

  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }

  return JSON.stringify(String(value));
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

type IdempotentResult = IdempotentResponse | { conflict: true };

async function runIdempotent(
  store: Map<string, IdempotencyEntry>,
  key: string,
  requestHash: string,
  fn: () => Promise<IdempotentResponse>,
): Promise<IdempotentResult> {
  pruneIdempotency(store);

  const existing = store.get(key);

  if (existing?.result) {
    if (existing.requestHash !== requestHash) return { conflict: true };
    return existing.result;
  }

  if (existing?.inFlight) {
    if (existing.requestHash !== requestHash) return { conflict: true };
    return existing.inFlight;
  }

  const inFlight = (async () => {
    const res = await fn();
    return res;
  })();

  store.set(key, { requestHash, inFlight, createdAtMs: Date.now() });

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
    },
  );
}
