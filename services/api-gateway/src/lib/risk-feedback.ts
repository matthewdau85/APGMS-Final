import { prisma } from "../db.js";

export interface RiskFeedbackInput {
  readonly orgId: string;
  readonly caseType: string;
  readonly caseId: string;
  readonly label: string;
  readonly override?: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly score: number;
  readonly submittedBy: string;
  readonly metadata?: Record<string, unknown>;
}

export async function recordRiskFeedback(input: RiskFeedbackInput) {
  return prisma.riskFeedback.create({
    data: {
      orgId: input.orgId,
      caseType: input.caseType,
      caseId: input.caseId,
      label: input.label,
      override: input.override ?? null,
      modelId: input.modelId,
      modelVersion: input.modelVersion,
      score: input.score,
      submittedBy: input.submittedBy,
      metadata: input.metadata ?? null,
    },
  });
}

export async function listRiskFeedback(orgId: string, caseType: string, caseId: string) {
  return prisma.riskFeedback.findMany({
    where: {
      orgId,
      caseType,
      caseId,
    },
    orderBy: { createdAt: "desc" },
  });
}
