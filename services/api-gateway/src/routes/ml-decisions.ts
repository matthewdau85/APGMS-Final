import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticateRequest, type Role } from "../lib/auth.js";
import { parseWithSchema } from "../lib/validation.js";
import {
  highRiskDecisionStore,
  type DecisionRecord,
} from "../lib/high-risk-decisions.js";
import { notFound, badRequest } from "@apgms/shared";

const FeedbackBodySchema = z
  .object({
    outcome: z.enum(["confirmed", "false_positive", "escalate"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

const OverrideBodySchema = z
  .object({
    resolution: z.enum(["approve", "deny"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

const decisionToResponse = (decision: DecisionRecord) => ({
  id: decision.id,
  orgId: decision.orgId,
  model: decision.model,
  riskScore: decision.riskScore,
  status: decision.status,
  createdAt: decision.createdAt.toISOString(),
  updatedAt: decision.updatedAt.toISOString(),
  metadata: decision.metadata,
  history: decision.history.map((entry) => ({
    timestamp: entry.timestamp.toISOString(),
    actorId: entry.actorId,
    action: entry.action,
    note: entry.note ?? null,
  })),
});

const principalKey = Symbol("mlDecisionPrincipal");

type PrincipalContainer = { [principalKey]?: { id: string; orgId: string; roles: Role[] } };

const gate = (
  app: FastifyInstance,
  roles: readonly Role[],
) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = await authenticateRequest(app, request, reply, roles);
    if (!principal) {
      return;
    }
    (request as FastifyRequest & PrincipalContainer)[principalKey] = {
      id: principal.id,
      orgId: principal.orgId,
      roles: principal.roles,
    };
  };

const getPrincipal = (request: FastifyRequest & PrincipalContainer) => {
  const principal = request[principalKey];
  if (!principal) {
    throw new Error("principal_missing");
  }
  return principal;
};

export async function registerMlDecisionRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (scope) => {
      scope.get(
        "/pending",
        { preHandler: gate(app, ["analyst", "admin", "auditor"]) },
        async (request) => {
          const principal = getPrincipal(request as typeof request & PrincipalContainer);
          const items = highRiskDecisionStore.listPending(principal.orgId);
          return {
            items: items.map(decisionToResponse),
          };
        },
      );

      scope.post(
        "/:id/feedback",
        { preHandler: gate(app, ["analyst", "admin", "auditor"]) },
        async (request, reply) => {
          const principal = getPrincipal(request as typeof request & PrincipalContainer);
          const body = parseWithSchema(FeedbackBodySchema, request.body);
          const { id } = request.params as { id: string };

          try {
            const decision = await highRiskDecisionStore.addFeedback({
              decisionId: id,
              orgId: principal.orgId,
              actorId: principal.id,
              outcome: body.outcome,
              note: body.note,
            });

            request.server.metrics?.recordSecurityEvent?.("ml.decision.feedback");

            reply.code(201).send({ decision: decisionToResponse(decision) });
          } catch (error) {
            if ((error as Error).message === "decision_not_found") {
              throw notFound("decision_not_found", "Decision not found");
            }
            throw error;
          }
        },
      );

      scope.post(
        "/:id/override",
        { preHandler: gate(app, ["admin"]) },
        async (request, reply) => {
          const principal = getPrincipal(request as typeof request & PrincipalContainer);
          const body = parseWithSchema(OverrideBodySchema, request.body);
          const { id } = request.params as { id: string };

          const decision = highRiskDecisionStore.get(id);
          if (!decision || decision.orgId !== principal.orgId) {
            throw notFound("decision_not_found", "Decision not found");
          }
          if (decision.status === "overridden") {
            throw badRequest("decision_already_overridden", "Decision already overridden");
          }

          const updated = await highRiskDecisionStore.overrideDecision({
            decisionId: id,
            orgId: principal.orgId,
            actorId: principal.id,
            resolution: body.resolution,
            note: body.note,
          });

          request.server.metrics?.recordSecurityEvent?.("ml.decision.override");

          reply.code(201).send({ decision: decisionToResponse(updated) });
        },
      );
    },
    { prefix: "/ml/decisions" },
  );
}
