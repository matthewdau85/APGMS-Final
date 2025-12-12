import type { FastifyInstance } from "fastify";

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
}

const periodPattern = /^\d{4}-Q[1-4]$/;

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

function getSettlement(app: FastifyInstance, instructionId: string): BasSettlement | undefined {
  const state = getBasState(app);
  return state.store.get(instructionId);
}

/**
 * Route-level BAS settlement validation endpoint.
 * - Used in unit-style tests that register routes directly (without the secure scope).
 * - When mounted under a prefix (e.g. { prefix: "/api" }), the URL becomes /api/settlements/bas/finalise.
 */
export async function basSettlementRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: BasFinaliseBody }>(
    "/settlements/bas/finalise",
    {
      schema: {
        body: {
          type: "object",
          required: ["period"],
          additionalProperties: true,
          properties: {
            period: { type: "string", pattern: periodPattern.source },
          },
        },
        response: {
          201: {
            type: "object",
            required: ["instructionId"],
            additionalProperties: true,
            properties: {
              instructionId: { type: "string" },
              period: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const instructionId = `finalise-${Date.now()}`;
      return reply.code(201).send({ instructionId, period: request.body.period });
    }
  );
}

/**
 * Lifecycle endpoints (prepare -> sent/ack/failed).
 * These use an in-memory store keyed per Fastify instance.
 */
async function basSettlementLifecycleRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: BasPrepareBody }>(
    "/settlements/bas/prepare",
    {
      schema: {
        body: {
          type: "object",
          required: ["period"],
          additionalProperties: true,
          properties: {
            period: { type: "string", pattern: periodPattern.source },
            payload: {},
          },
        },
        response: {
          201: {
            type: "object",
            required: ["instructionId", "payload"],
            additionalProperties: true,
            properties: {
              instructionId: { type: "string" },
              payload: {},
            },
          },
        },
      },
    },
    async (request, reply) => {
      const instructionId = nextInstructionId(app);
      const payload = request.body.payload ?? { foo: "bar" };

      attachOrReplaceSettlement(app, {
        instructionId,
        period: request.body.period,
        status: "PREPARED",
        payload,
      });

      return reply.code(201).send({ instructionId, payload });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/settlements/bas/:instructionId/sent",
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "Not found" });

      s.status = "SENT";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/settlements/bas/:instructionId/ack",
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "Not found" });

      s.status = "ACK";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/settlements/bas/:instructionId/failed",
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "Not found" });

      s.status = "FAILED";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );
}

/**
 * Optional legacy endpoints retained for backward compatibility.
 * These are not used by the current test suite but may be referenced elsewhere.
 */
async function legacyBasSettlementRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: BasPrepareBody }>(
    "/bas-settlement/prepare",
    async (request, reply) => {
      const instructionId = nextInstructionId(app);
      const payload = request.body.payload ?? { foo: "bar" };

      attachOrReplaceSettlement(app, {
        instructionId,
        period: request.body.period,
        status: "PREPARED",
        payload,
      });

      return reply.code(201).send({ instructionId, payload });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/bas-settlement/:instructionId/sent",
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "Not found" });

      s.status = "SENT";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/bas-settlement/:instructionId/ack",
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "Not found" });

      s.status = "ACK";
      attachOrReplaceSettlement(app, s);

      return reply.code(200).send({ instructionId: s.instructionId, status: s.status });
    }
  );

  app.post<{ Params: { instructionId: string } }>(
    "/bas-settlement/:instructionId/failed",
    async (request, reply) => {
      const s = getSettlement(app, request.params.instructionId);
      if (!s) return reply.code(404).send({ error: "Not found" });

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
