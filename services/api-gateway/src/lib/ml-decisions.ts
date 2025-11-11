import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";
import { recordAuditLog } from "./audit.js";
import type { PolicyEvaluation } from "./ml-client.js";

export type DecisionScenario = "shortfall" | "fraud" | "plan";

export interface RecordDecisionInput {
  orgId: string;
  actorId: string;
  scenario: DecisionScenario;
  evaluation: PolicyEvaluation & { features?: Record<string, number> };
  decision: "APPROVED" | "OVERRIDDEN" | "BLOCKED";
  rationale: string;
}

export async function recordDecision({
  orgId,
  actorId,
  scenario,
  evaluation,
  decision,
  rationale,
}: RecordDecisionInput) {
  const payload = {
    score: evaluation.score,
    policyThreshold: evaluation.policyThreshold,
    modelThreshold: evaluation.model.threshold,
    contributions: evaluation.contributions,
    drift: evaluation.drift,
    features: evaluation.features ?? {},
  };

  const created = await prisma.mlDecisionLog.create({
    data: {
      orgId,
      scenario,
      score: new Prisma.Decimal(evaluation.score.toFixed(4)),
      policyThreshold: new Prisma.Decimal(evaluation.policyThreshold.toFixed(4)),
      modelThreshold: new Prisma.Decimal(evaluation.model.threshold.toFixed(4)),
      decision,
      rationale,
      createdBy: actorId,
      payload,
      modelId: evaluation.model.id,
      modelVersion: evaluation.model.version,
      issuedAt: new Date(evaluation.issuedAt),
      policyPassed: evaluation.policyPassed,
    },
  });

  await recordAuditLog({
    orgId,
    actorId,
    action: `ml.decision.${scenario}`,
    metadata: {
      decision,
      score: evaluation.score,
      policyThreshold: evaluation.policyThreshold,
      modelThreshold: evaluation.model.threshold,
      decisionId: created.id,
    },
  });

  return created;
}

export async function listDecisions(orgId: string) {
  const rows = await prisma.mlDecisionLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return rows.map((row) => ({
    id: row.id,
    scenario: row.scenario,
    decision: row.decision,
    rationale: row.rationale,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    score: Number.parseFloat(row.score.toString()),
    policyThreshold: Number.parseFloat(row.policyThreshold.toString()),
    modelThreshold: Number.parseFloat(row.modelThreshold.toString()),
    modelId: row.modelId,
    modelVersion: row.modelVersion,
    issuedAt: row.issuedAt.toISOString(),
    policyPassed: row.policyPassed,
  }));
}

export async function hasApprovedDecision(
  orgId: string,
  scenario: DecisionScenario,
  issuedAt: Date,
): Promise<boolean> {
  const decision = await prisma.mlDecisionLog.findFirst({
    where: {
      orgId,
      scenario,
      createdAt: { gte: issuedAt },
      decision: { in: ["APPROVED", "OVERRIDDEN"] },
    },
    orderBy: { createdAt: "desc" },
  });

  return Boolean(decision);
}
