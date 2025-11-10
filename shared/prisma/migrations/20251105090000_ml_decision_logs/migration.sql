-- ML decision logging for BAS readiness, fraud review, and compliance plans

CREATE TABLE "RiskDecisionLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "orgId" TEXT,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT,
  "modelName" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "recommendation" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL,
  "rationale" TEXT,
  "operatorId" TEXT,
  "operatorName" TEXT,
  "metadata" JSONB,
  "prevHash" TEXT,
  "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "RiskDecisionLog_subjectType_createdAt_idx"
  ON "RiskDecisionLog" ("subjectType", "createdAt");

CREATE INDEX "RiskDecisionLog_orgId_createdAt_idx"
  ON "RiskDecisionLog" ("orgId", "createdAt");
