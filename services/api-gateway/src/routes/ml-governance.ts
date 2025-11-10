import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../auth.js";
import { parseWithSchema } from "../lib/validation.js";
import { MlServiceClient } from "../clients/mlServiceClient.js";
import { appendDecisionLog, listDecisionLogs } from "../lib/decision-log.js";

const mlClient = new MlServiceClient();

const operatorSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional()
});

const shortfallDecisionSchema = z.object({
  orgId: z.string().min(1).optional(),
  basCycleId: z.string().min(1).optional(),
  metrics: z.object({
    liquidityRatio: z.number().min(0),
    burnRate: z.number().min(0),
    variance: z.number().min(0)
  }),
  decision: z.enum(["approve", "block"]),
  rationale: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
  operator: operatorSchema.optional()
});

const fraudDecisionSchema = z.object({
  orgId: z.string().min(1).optional(),
  transactionId: z.string().min(1),
  metrics: z.object({
    amount: z.number().min(0),
    velocity: z.number().min(0),
    geoRisk: z.number().min(0)
  }),
  decision: z.enum(["approve", "block"]),
  rationale: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
  operator: operatorSchema.optional()
});

const compliancePlanSchema = z.object({
  orgId: z.string().min(1).optional(),
  metrics: z.object({
    controlCoverage: z.number().min(0).max(1),
    openFindings: z.number().min(0),
    trainingCompletion: z.number().min(0).max(1)
  })
});

const complianceDecisionSchema = compliancePlanSchema.extend({
  planId: z.string().min(1).optional(),
  decision: z.enum(["adopt", "defer"]),
  rationale: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
  operator: operatorSchema.optional()
});

const listDecisionsSchema = z.object({
  subjectType: z.string().optional(),
  limit: z
    .string()
    .regex(/^[0-9]+$/)
    .transform((value) => Number.parseInt(value, 10))
    .optional()
});

type AuthenticatedUser = {
  sub: string;
  orgId: string;
  role: string;
};

function getUser(request: any): AuthenticatedUser {
  const user = request.user as AuthenticatedUser | undefined;
  if (!user) {
    throw new Error("missing_user_context");
  }
  return user;
}

export async function registerMlGovernanceRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (privateScope) => {
    privateScope.addHook("onRequest", authGuard);

    privateScope.post("/risk/shortfall/decision", async (request, reply) => {
      const body = parseWithSchema(shortfallDecisionSchema, request.body);
      const user = getUser(request);
      const evaluation = await mlClient.evaluateShortfall(body.metrics);
      const approved = body.decision === "approve" && evaluation.allow;
      const log = await appendDecisionLog({
        orgId: body.orgId ?? user.orgId,
        subjectType: "bas_readiness",
        subjectId: body.basCycleId ?? null,
        modelName: evaluation.evaluation.model.name,
        modelVersion: evaluation.evaluation.model.version,
        score: evaluation.evaluation.score,
        threshold: evaluation.threshold,
        recommendation: evaluation.evaluation.recommendation,
        decision: body.decision,
        approved,
        rationale: body.rationale,
        operatorId: body.operator?.id ?? user.sub,
        operatorName: body.operator?.name,
        metadata: {
          metrics: body.metrics,
          metadata: body.metadata ?? null,
          drift: evaluation.evaluation.drift,
          allow: evaluation.allow
        }
      });

      reply.send({
        evaluation: evaluation.evaluation,
        threshold: evaluation.threshold,
        allow: evaluation.allow,
        operatorDecision: {
          decision: body.decision,
          approved,
          rationale: body.rationale ?? null
        },
        logId: log.id
      });
    });

    privateScope.post("/risk/fraud/decision", async (request, reply) => {
      const body = parseWithSchema(fraudDecisionSchema, request.body);
      const user = getUser(request);
      const evaluation = await mlClient.evaluateFraud(body.metrics);
      const approved = body.decision === "approve" && evaluation.allow;
      const log = await appendDecisionLog({
        orgId: body.orgId ?? user.orgId,
        subjectType: "fraud_review",
        subjectId: body.transactionId,
        modelName: evaluation.evaluation.model.name,
        modelVersion: evaluation.evaluation.model.version,
        score: evaluation.evaluation.score,
        threshold: evaluation.threshold,
        recommendation: evaluation.evaluation.recommendation,
        decision: body.decision,
        approved,
        rationale: body.rationale,
        operatorId: body.operator?.id ?? user.sub,
        operatorName: body.operator?.name,
        metadata: {
          metrics: body.metrics,
          metadata: body.metadata ?? null,
          drift: evaluation.evaluation.drift,
          allow: evaluation.allow
        }
      });

      reply.send({
        evaluation: evaluation.evaluation,
        threshold: evaluation.threshold,
        allow: evaluation.allow,
        operatorDecision: {
          decision: body.decision,
          approved,
          rationale: body.rationale ?? null
        },
        logId: log.id
      });
    });

    privateScope.get("/risk/decisions", async (request, reply) => {
      const query = parseWithSchema(listDecisionsSchema, request.query);
      const logs = await listDecisionLogs(query.subjectType, query.limit ?? 20);
      reply.send({
        decisions: logs.map((entry) => ({
          id: entry.id,
          subjectType: entry.subjectType,
          subjectId: entry.subjectId,
          score: entry.score,
          threshold: entry.threshold,
          recommendation: entry.recommendation,
          decision: entry.decision,
          approved: entry.approved,
          rationale: entry.rationale,
          operatorId: entry.operatorId,
          operatorName: entry.operatorName,
          metadata: entry.metadata,
          createdAt: entry.createdAt,
          hash: entry.hash,
          prevHash: entry.prevHash
        }))
      });
    });

    privateScope.post("/plan/compliance", async (request, reply) => {
      const body = parseWithSchema(compliancePlanSchema, request.body);
      const user = getUser(request);
      const result = await mlClient.buildCompliancePlan(body.metrics);

      reply.send({
        plan: result.plan,
        threshold: result.threshold,
        attention: result.attention,
        orgId: body.orgId ?? user.orgId
      });
    });

    privateScope.post("/plan/compliance/decision", async (request, reply) => {
      const body = parseWithSchema(complianceDecisionSchema, request.body);
      const user = getUser(request);
      const result = await mlClient.buildCompliancePlan(body.metrics);
      const approved = body.decision === "adopt" && !result.attention;
      const log = await appendDecisionLog({
        orgId: body.orgId ?? user.orgId,
        subjectType: "compliance_plan",
        subjectId: body.planId ?? null,
        modelName: result.plan.model.name,
        modelVersion: result.plan.model.version,
        score: result.plan.score,
        threshold: result.threshold,
        recommendation: result.plan.maturity,
        decision: body.decision,
        approved,
        rationale: body.rationale,
        operatorId: body.operator?.id ?? user.sub,
        operatorName: body.operator?.name,
        metadata: {
          metrics: body.metrics,
          metadata: body.metadata ?? null,
          tasks: result.plan.tasks,
          attention: result.attention
        }
      });

      reply.send({
        plan: result.plan,
        threshold: result.threshold,
        attention: result.attention,
        operatorDecision: {
          decision: body.decision,
          approved,
          rationale: body.rationale ?? null
        },
        logId: log.id
      });
    });

    privateScope.get("/plan/decisions", async (request, reply) => {
      const query = parseWithSchema(listDecisionsSchema, request.query);
      const logs = await listDecisionLogs(
        query.subjectType ?? "compliance_plan",
        query.limit ?? 20
      );
      reply.send({
        decisions: logs.map((entry) => ({
          id: entry.id,
          subjectType: entry.subjectType,
          subjectId: entry.subjectId,
          score: entry.score,
          threshold: entry.threshold,
          recommendation: entry.recommendation,
          decision: entry.decision,
          approved: entry.approved,
          rationale: entry.rationale,
          operatorId: entry.operatorId,
          operatorName: entry.operatorName,
          metadata: entry.metadata,
          createdAt: entry.createdAt,
          hash: entry.hash,
          prevHash: entry.prevHash
        }))
      });
    });
  });
}
