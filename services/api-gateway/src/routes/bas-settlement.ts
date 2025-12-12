import type { FastifyInstance } from "fastify";
import { requireWritesEnabled } from "../guards/service-mode";

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
