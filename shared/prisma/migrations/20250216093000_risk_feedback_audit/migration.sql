CREATE TABLE "RiskFeedback" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "caseType" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "override" TEXT,
  "modelId" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "submittedBy" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RiskFeedback_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE
);

CREATE INDEX "RiskFeedback_lookup_idx" ON "RiskFeedback"("orgId", "caseType", "caseId");
