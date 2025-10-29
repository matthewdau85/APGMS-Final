-- Phase 4: Payment plan requests

CREATE TABLE "PaymentPlanRequest" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "basCycleId" TEXT NOT NULL REFERENCES "BasCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "detailsJson" JSONB NOT NULL,
  "resolvedAt" TIMESTAMP(3)
);

CREATE INDEX "PaymentPlanRequest_orgId_basCycleId_idx"
  ON "PaymentPlanRequest"("orgId","basCycleId");

CREATE INDEX "PaymentPlanRequest_orgId_status_idx"
  ON "PaymentPlanRequest"("orgId","status");
