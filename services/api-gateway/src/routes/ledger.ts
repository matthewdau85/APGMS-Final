import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authGuard } from "../auth.js";
import { publishStructuredEvent } from "../lib/event-publisher.js";

const financeRoles = new Set(["finance", "analyst", "admin"]);

const discrepancySchema = z.object({
  discrepancyId: z.string().uuid().optional(),
  eventKey: z.string().min(1).optional(),
  category: z.string().min(1),
  eventType: z.string().min(1),
  severity: z.string().optional(),
  detectedAt: z.preprocess((value) =>
    typeof value === "string" || value instanceof Date ? new Date(value) : value,
  z.date()),
  shortfallCents: z.number().int().optional(),
  description: z.string().max(2000).optional(),
  source: z.string().min(1).default("api"),
  metadata: z.record(z.string(), z.any()).optional(),
});

const resolutionSchema = z.object({
  resolutionId: z.string().uuid().optional(),
  resolutionType: z.string().min(1),
  overrideAmountCents: z.number().int().optional(),
  notes: z.string().max(2000).optional(),
  appliedAt: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      if (typeof value === "string" || value instanceof Date) {
        return new Date(value);
      }
      return value;
    }, z.date())
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  status: z.string().min(1).optional(),
});

function ensureFinanceRole(request: FastifyRequest, reply: FastifyReply): boolean {
  const user = (request as any).user as { role?: string } | undefined;
  if (!user?.role || !financeRoles.has(user.role)) {
    void reply.code(403).send({ error: { code: "forbidden" } });
    return false;
  }
  return true;
}

export async function registerLedgerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (ledgerScope) => {
    ledgerScope.addHook("onRequest", authGuard);

    ledgerScope.post("/ledger/discrepancies", async (request, reply) => {
      if (!ensureFinanceRole(request, reply)) {
        return;
      }

      const parseResult = discrepancySchema.safeParse(request.body ?? {});
      if (!parseResult.success) {
        void reply
          .code(400)
          .send({ error: { code: "invalid_body", details: parseResult.error.flatten() } });
        return;
      }

      const payload = parseResult.data;
      const user = (request as any).user as { sub: string; orgId: string; role: string };
      const discrepancyId = payload.discrepancyId ?? randomUUID();
      const eventKey = payload.eventKey ?? `${payload.category}:${payload.eventType}:${discrepancyId}`;

      await publishStructuredEvent(
        app,
        "ledger.discrepancy",
        "ledger.discrepancy.detected",
        user.orgId,
        {
          schemaVersion: "2025-11-05",
          key: eventKey,
          dedupeKey: `${user.orgId}:${eventKey}`,
          discrepancyId,
          category: payload.category,
          eventType: payload.eventType,
          status: "open",
          severity: payload.severity ?? null,
          detectedAt: payload.detectedAt.toISOString(),
          shortfallCents: payload.shortfallCents ?? null,
          description: payload.description ?? null,
          metadata: payload.metadata ?? {},
          source: payload.source,
          initiatedBy: {
            userId: user.sub,
            role: user.role,
          },
        },
        request,
      );

      void reply.code(201).send({
        discrepancyId,
        eventKey,
        status: "queued",
      });
    });

    ledgerScope.post("/ledger/discrepancies/:id/manual-resolution", async (request, reply) => {
      if (!ensureFinanceRole(request, reply)) {
        return;
      }

      const params = request.params as { id?: string };
      if (!params?.id) {
        void reply.code(400).send({ error: { code: "invalid_parameters" } });
        return;
      }

      const parseResult = resolutionSchema.safeParse(request.body ?? {});
      if (!parseResult.success) {
        void reply
          .code(400)
          .send({ error: { code: "invalid_body", details: parseResult.error.flatten() } });
        return;
      }

      const payload = parseResult.data;
      const user = (request as any).user as { sub: string; orgId: string; role: string };
      const resolutionId = payload.resolutionId ?? randomUUID();

      await publishStructuredEvent(
        app,
        "ledger.discrepancy",
        "ledger.discrepancy.manual_resolution",
        user.orgId,
        {
          schemaVersion: "2025-11-05",
          key: `${params.id}:resolution:${resolutionId}`,
          dedupeKey: `${user.orgId}:${params.id}:resolution:${resolutionId}`,
          discrepancyId: params.id,
          resolutionId,
          resolutionType: payload.resolutionType,
          overrideAmountCents: payload.overrideAmountCents ?? null,
          notes: payload.notes ?? null,
          appliedAt: payload.appliedAt?.toISOString() ?? null,
          metadata: payload.metadata ?? {},
          status: payload.status ?? "resolved",
          resolvedBy: {
            userId: user.sub,
            role: user.role,
          },
        },
        request,
      );

      void reply.code(202).send({
        discrepancyId: params.id,
        resolutionId,
        status: payload.status ?? "resolved",
      });
    });
  });
}

export default registerLedgerRoutes;
