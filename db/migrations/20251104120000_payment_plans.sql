-- Payment plan requests ensure BAS shortfalls are tracked alongside remediation intent.
CREATE TABLE IF NOT EXISTS "PaymentPlanRequest" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "basCycleId" TEXT NOT NULL REFERENCES "BasCycle"("id") ON DELETE CASCADE,
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "detailsJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "resolvedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "PaymentPlanRequest_orgId_basCycleId_idx"
  ON "PaymentPlanRequest"("orgId", "basCycleId");

CREATE INDEX IF NOT EXISTS "PaymentPlanRequest_orgId_status_idx"
  ON "PaymentPlanRequest"("orgId", "status");
