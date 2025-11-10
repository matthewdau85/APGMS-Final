import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticateRequest, type Role } from "../lib/auth.js";
import { parseWithSchema } from "../lib/validation.js";
import { listRiskFeedback, recordRiskFeedback } from "../lib/risk-feedback.js";
import type {
  CompliancePlanPayload,
  FraudRiskPayload,
  RiskEvaluation,
  RiskFeedbackPayload,
  ShortfallRiskPayload,
} from "../clients/ml-service.js";

const financeRoles: Role[] = ["finance", "admin", "analyst"];
const fraudRoles: Role[] = ["analyst", "admin"];

const shortfallSchema = z.object({
  basCycleId: z.string().min(1).optional(),
  cashCoverageRatio: z.number().min(0),
  varianceIndex: z.number(),
  openAlertRatio: z.number().min(0),
});

const fraudSchema = z.object({
  caseId: z.string().min(1).optional(),
  velocityScore: z.number().min(0),
  patternDeviation: z.number().min(0),
  vendorConcentration: z.number().min(0),
});

const complianceSchema = z.object({
  caseId: z.string().min(1).optional(),
  installmentReliability: z.number().min(0),
  liquidityBuffer: z.number(),
  planHistory: z.number(),
});

const feedbackSchema = z.object({
  caseType: z.string().min(1),
  caseId: z.string().min(1),
  label: z.string().min(1),
  override: z.string().min(1).optional(),
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
  score: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const feedbackParamsSchema = z.object({
  caseType: z.string().min(1),
  caseId: z.string().min(1),
});

export async function registerRiskRoutes(app: FastifyInstance): Promise<void> {
  app.post("/risk/shortfall", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, financeRoles);
    if (!principal) return;
    const body = parseWithSchema(shortfallSchema, request.body);
    const payload: ShortfallRiskPayload = {
      orgId: principal.orgId,
      basCycleId: body.basCycleId,
      cashCoverageRatio: body.cashCoverageRatio,
      varianceIndex: body.varianceIndex,
      openAlertRatio: body.openAlertRatio,
    };
    const evaluation = await app.mlClient.scoreShortfall(payload);
    reply.send({
      risk: formatEvaluation(evaluation, body.basCycleId ?? null),
    });
  });

  app.post("/risk/fraud", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, fraudRoles);
    if (!principal) return;
    const body = parseWithSchema(fraudSchema, request.body);
    const payload: FraudRiskPayload = {
      orgId: principal.orgId,
      velocityScore: body.velocityScore,
      patternDeviation: body.patternDeviation,
      vendorConcentration: body.vendorConcentration,
    };
    const evaluation = await app.mlClient.scoreFraud(payload);
    reply.send({
      risk: formatEvaluation(evaluation, body.caseId ?? null),
    });
  });

  app.post("/plan/compliance", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, financeRoles);
    if (!principal) return;
    const body = parseWithSchema(complianceSchema, request.body);
    const payload: CompliancePlanPayload = {
      orgId: principal.orgId,
      installmentReliability: body.installmentReliability,
      liquidityBuffer: body.liquidityBuffer,
      planHistory: body.planHistory,
    };
    const evaluation = await app.mlClient.scoreCompliancePlan(payload);
    reply.send({
      risk: formatEvaluation(evaluation, body.caseId ?? null),
    });
  });

  app.post("/risk/feedback", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, financeRoles);
    if (!principal) return;
    const body = parseWithSchema(feedbackSchema, request.body);
    const stored = await recordRiskFeedback({
      orgId: principal.orgId,
      caseType: body.caseType,
      caseId: body.caseId,
      label: body.label,
      override: body.override,
      modelId: body.modelId,
      modelVersion: body.modelVersion,
      score: body.score,
      submittedBy: principal.id,
      metadata: body.metadata,
    });
    void app.mlClient.submitFeedback({
      orgId: principal.orgId,
      caseType: body.caseType,
      caseId: body.caseId,
      label: body.label,
      override: body.override,
      modelId: body.modelId,
      modelVersion: body.modelVersion,
      score: body.score,
      submittedBy: principal.id,
      metadata: body.metadata,
    } satisfies RiskFeedbackPayload);
    reply.code(201).send({ feedback: stored });
  });

  app.get("/risk/feedback/:caseType/:caseId", async (request, reply) => {
    const principal = await authenticateRequest(app, request, reply, financeRoles);
    if (!principal) return;
    const params = parseWithSchema(feedbackParamsSchema, request.params);
    const records = await listRiskFeedback(principal.orgId, params.caseType, params.caseId);
    reply.send({ feedback: records });
  });
}

function formatEvaluation(evaluation: RiskEvaluation, caseId: string | null) {
  const decision = evaluation.requiresManualReview ? "hold" : "allow";
  return {
    modelId: evaluation.modelId,
    modelVersion: evaluation.modelVersion,
    score: evaluation.score,
    confidenceInterval: evaluation.confidenceInterval,
    recommendedActions: evaluation.recommendedActions,
    contributingFeatures: evaluation.contributingFeatures,
    requiresManualReview: evaluation.requiresManualReview,
    decision,
    threshold: evaluation.threshold,
    caseId,
  };
}
