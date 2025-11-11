CREATE TABLE "MlDecisionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "scenario" TEXT NOT NULL,
    "score" NUMERIC(6,4) NOT NULL,
    "policyThreshold" NUMERIC(6,4) NOT NULL,
    "modelThreshold" NUMERIC(6,4) NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "issuedAt" TIMESTAMP NOT NULL,
    "policyPassed" BOOLEAN NOT NULL
);

CREATE INDEX "MlDecisionLog_orgId_scenario_createdAt_idx"
    ON "MlDecisionLog"("orgId", "scenario", "createdAt");

CREATE INDEX "MlDecisionLog_orgId_createdBy_createdAt_idx"
    ON "MlDecisionLog"("orgId", "createdBy", "createdAt");
