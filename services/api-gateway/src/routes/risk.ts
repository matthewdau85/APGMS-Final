import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { authenticateRequest } from "../lib/auth.js";
import {
  evaluateBasReadiness,
  evaluateFraudSignals,
  evaluatePlanCompliance,
} from "../lib/ml-policy.js";
import { listDecisions, recordDecision } from "../lib/ml-decisions.js";

const decisionSchema = z.object({
  scenario: z.enum(["shortfall", "fraud", "plan"]),
  decision: z.enum(["APPROVED", "OVERRIDDEN", "BLOCKED"]),
  rationale: z.string().min(5),
  score: z.number().min(0).max(1),
  policyThreshold: z.number().min(0).max(1),
  modelThreshold: z.number().min(0).max(1),
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
  issuedAt: z.string().min(1),
});

export const registerRiskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/risk/insights", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, ["admin", "analyst", "finance"]);
    if (!principal) {
      return;
    }

    const [shortfall, fraud, plan, decisions] = await Promise.all([
      evaluateBasReadiness(principal.orgId),
      evaluateFraudSignals(principal.orgId),
      evaluatePlanCompliance(principal.orgId),
      listDecisions(principal.orgId),
    ]);

    reply.send({
      shortfall,
      fraud,
      plan,
      decisions,
    });
  });

  app.post("/risk/decisions", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, ["admin", "analyst"]);
    if (!principal) {
      return;
    }

    const parsed = decisionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }

    const evaluation = await (async () => {
      switch (parsed.data.scenario) {
        case "shortfall":
          return evaluateBasReadiness(principal.orgId);
        case "fraud":
          return evaluateFraudSignals(principal.orgId);
        case "plan":
        default:
          return evaluatePlanCompliance(principal.orgId);
      }
    })();

    const recorded = await recordDecision({
      orgId: principal.orgId,
      actorId: principal.id,
      scenario: parsed.data.scenario,
      evaluation,
      decision: parsed.data.decision,
      rationale: parsed.data.rationale,
    });

    reply.code(201).send({ decision: recorded });
  });
};
