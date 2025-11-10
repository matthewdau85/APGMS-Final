import { createHash } from "node:crypto";
import { prisma } from "../db.js";

export interface AppendDecisionLogInput {
  orgId?: string | null;
  subjectType: string;
  subjectId?: string | null;
  modelName: string;
  modelVersion: string;
  score: number;
  threshold: number;
  recommendation: string;
  decision: string;
  approved: boolean;
  rationale?: string;
  operatorId?: string;
  operatorName?: string;
  metadata?: Record<string, unknown> | null;
}

function computeHash(prevHash: string | null, payload: AppendDecisionLogInput): string {
  const hash = createHash("sha256");
  if (prevHash) hash.update(prevHash);
  hash.update(JSON.stringify({
    subjectType: payload.subjectType,
    subjectId: payload.subjectId ?? null,
    modelName: payload.modelName,
    modelVersion: payload.modelVersion,
    score: payload.score,
    threshold: payload.threshold,
    recommendation: payload.recommendation,
    decision: payload.decision,
    approved: payload.approved,
    rationale: payload.rationale ?? null,
    operatorId: payload.operatorId ?? null,
    operatorName: payload.operatorName ?? null,
    metadata: payload.metadata ?? null
  }));
  return hash.digest("hex");
}

export async function appendDecisionLog(input: AppendDecisionLogInput) {
  const prev = await prisma.riskDecisionLog.findFirst({
    orderBy: { createdAt: "desc" }
  });
  const prevHash = prev?.hash ?? null;
  const hash = computeHash(prevHash, input);

  return prisma.riskDecisionLog.create({
    data: {
      orgId: input.orgId ?? null,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      modelName: input.modelName,
      modelVersion: input.modelVersion,
      score: input.score,
      threshold: input.threshold,
      recommendation: input.recommendation,
      decision: input.decision,
      approved: input.approved,
      rationale: input.rationale ?? null,
      operatorId: input.operatorId ?? null,
      operatorName: input.operatorName ?? null,
      metadata: input.metadata ?? null,
      prevHash,
      hash
    }
  });
}

export async function listDecisionLogs(subjectType?: string, limit = 50) {
  return prisma.riskDecisionLog.findMany({
    where: subjectType ? { subjectType } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit
  });
}
