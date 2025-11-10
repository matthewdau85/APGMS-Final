import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

import {
  evaluateLinearModel,
  loadModels,
  type ModelRepository,
} from "./model-loader.js";
import { FeedbackStore } from "./feedback-store.js";
import type {
  CompliancePlanFeatures,
  FeedbackInput,
  FraudFeatures,
  RiskEvaluation,
  ShortfallFeatures,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const modelRoot = resolve(__dirname, "../models");
const dataRoot = resolve(__dirname, "../data");

export interface MlServiceContext {
  readonly models: ModelRepository;
  readonly feedback: FeedbackStore;
}

export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const requestCounter = new Counter({
    name: "ml_service_requests_total",
    help: "Total number of ML service scoring requests",
    labelNames: ["endpoint"],
    registers: [registry],
  });

  const latencyHistogram = new Histogram({
    name: "ml_service_request_duration_seconds",
    help: "Duration histogram for ML scoring",
    labelNames: ["endpoint"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [registry],
  });

  const models = await loadModels(modelRoot);
  const feedbackStore = new FeedbackStore(dataRoot);
  await feedbackStore.init();

  const context: MlServiceContext = { models, feedback: feedbackStore };
  app.decorate("mlContext", context);

  app.get("/health", async () => ({ ok: true, service: "ml-service" }));

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", registry.contentType);
    reply.send(await registry.metrics());
  });

  app.post<{ Body: ShortfallFeatures }>(
    "/risk/shortfall",
    {
      schema: {
        body: shortfallSchema,
      },
    },
    async (request) => {
      const endTimer = latencyHistogram.startTimer({ endpoint: "risk_shortfall" });
      requestCounter.inc({ endpoint: "risk_shortfall" });
      try {
        return {
          evaluation: evaluateShortfall(context.models, request.body),
        };
      } finally {
        endTimer();
      }
    },
  );

  app.post<{ Body: FraudFeatures }>(
    "/risk/fraud",
    {
      schema: {
        body: fraudSchema,
      },
    },
    async (request) => {
      const endTimer = latencyHistogram.startTimer({ endpoint: "risk_fraud" });
      requestCounter.inc({ endpoint: "risk_fraud" });
      try {
        return {
          evaluation: evaluateFraud(context.models, request.body),
        };
      } finally {
        endTimer();
      }
    },
  );

  app.post<{ Body: CompliancePlanFeatures }>(
    "/plan/compliance",
    {
      schema: {
        body: complianceSchema,
      },
    },
    async (request) => {
      const endTimer = latencyHistogram.startTimer({ endpoint: "plan_compliance" });
      requestCounter.inc({ endpoint: "plan_compliance" });
      try {
        return {
          evaluation: evaluateCompliancePlan(context.models, request.body),
        };
      } finally {
        endTimer();
      }
    },
  );

  app.post<{ Body: FeedbackInput }>(
    "/feedback",
    {
      schema: {
        body: feedbackSchema,
      },
    },
    async (request, reply) => {
      const record = await feedbackStore.add(request.body);
      reply.code(201);
      return { feedback: record };
    },
  );

  app.get<{ Params: { caseType: string; caseId: string } }>(
    "/feedback/:caseType/:caseId",
    async (request) => {
      const { caseType, caseId } = request.params;
      const records = await feedbackStore.listByCase(caseType, caseId);
      return { feedback: records };
    },
  );

  return app;
}

function evaluateShortfall(models: ModelRepository, features: ShortfallFeatures): RiskEvaluation {
  const featureVector = {
    cashCoverageRatio: features.cashCoverageRatio,
    varianceIndex: features.varianceIndex,
    openAlertRatio: features.openAlertRatio,
  };
  const { score, confidenceInterval, recommendedActions } = evaluateLinearModel(
    models.shortfall,
    featureVector,
  );

  return {
    modelId: models.shortfall.id,
    modelVersion: models.shortfall.version,
    score,
    confidenceInterval,
    recommendedActions,
    contributingFeatures: featureVector,
  };
}

function evaluateFraud(models: ModelRepository, features: FraudFeatures): RiskEvaluation {
  const featureVector = {
    velocityScore: features.velocityScore,
    patternDeviation: features.patternDeviation,
    vendorConcentration: features.vendorConcentration,
  };
  const { score, confidenceInterval, recommendedActions } = evaluateLinearModel(
    models.fraud,
    featureVector,
  );

  return {
    modelId: models.fraud.id,
    modelVersion: models.fraud.version,
    score,
    confidenceInterval,
    recommendedActions,
    contributingFeatures: featureVector,
  };
}

function evaluateCompliancePlan(
  models: ModelRepository,
  features: CompliancePlanFeatures,
): RiskEvaluation {
  const featureVector = {
    installmentReliability: features.installmentReliability,
    liquidityBuffer: features.liquidityBuffer,
    planHistory: features.planHistory,
  };
  const { score, confidenceInterval, recommendedActions } = evaluateLinearModel(
    models.compliancePlan,
    featureVector,
  );

  return {
    modelId: models.compliancePlan.id,
    modelVersion: models.compliancePlan.version,
    score,
    confidenceInterval,
    recommendedActions,
    contributingFeatures: featureVector,
  };
}

const shortfallSchema = {
  type: "object",
  required: [
    "orgId",
    "cashCoverageRatio",
    "varianceIndex",
    "openAlertRatio",
  ],
  properties: {
    orgId: { type: "string" },
    basCycleId: { type: "string" },
    cashCoverageRatio: { type: "number" },
    varianceIndex: { type: "number" },
    openAlertRatio: { type: "number" },
  },
  additionalProperties: false,
} as const;

const fraudSchema = {
  type: "object",
  required: ["orgId", "velocityScore", "patternDeviation", "vendorConcentration"],
  properties: {
    orgId: { type: "string" },
    velocityScore: { type: "number" },
    patternDeviation: { type: "number" },
    vendorConcentration: { type: "number" },
  },
  additionalProperties: false,
} as const;

const complianceSchema = {
  type: "object",
  required: ["orgId", "installmentReliability", "liquidityBuffer", "planHistory"],
  properties: {
    orgId: { type: "string" },
    installmentReliability: { type: "number" },
    liquidityBuffer: { type: "number" },
    planHistory: { type: "number" },
  },
  additionalProperties: false,
} as const;

const feedbackSchema = {
  type: "object",
  required: [
    "caseType",
    "caseId",
    "orgId",
    "label",
    "modelId",
    "modelVersion",
    "score",
  ],
  properties: {
    caseType: { type: "string" },
    caseId: { type: "string" },
    orgId: { type: "string" },
    label: { type: "string" },
    override: { type: "string" },
    modelId: { type: "string" },
    modelVersion: { type: "string" },
    score: { type: "number" },
    submittedBy: { type: "string" },
    metadata: { type: "object" },
  },
  additionalProperties: false,
} as const;
