-- Risk and remediation tables for discrepancy + fraud events
CREATE TABLE "DiscrepancyEvent" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "eventType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "receivedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "traceId" TEXT,
  "dedupeId" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "acknowledgedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "DiscrepancyEvent_orgId_dedupeId_key" ON "DiscrepancyEvent"("orgId", "dedupeId");
CREATE INDEX "DiscrepancyEvent_orgId_occurredAt_idx" ON "DiscrepancyEvent"("orgId", "occurredAt");
CREATE INDEX "DiscrepancyEvent_eventType_idx" ON "DiscrepancyEvent"("eventType");

CREATE TABLE "FraudAlert" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "discrepancyId" TEXT REFERENCES "DiscrepancyEvent"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "severity" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "evidence" JSONB,
  "openedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "closedAt" TIMESTAMP WITH TIME ZONE,
  "resolutionNote" TEXT
);

CREATE INDEX "FraudAlert_orgId_status_idx" ON "FraudAlert"("orgId", "status");

CREATE TABLE "RemediationAction" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "discrepancyId" TEXT REFERENCES "DiscrepancyEvent"("id") ON DELETE SET NULL,
  "fraudAlertId" TEXT REFERENCES "FraudAlert"("id") ON DELETE SET NULL,
  "actionType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "createdBy" TEXT,
  "executedAt" TIMESTAMP WITH TIME ZONE,
  "notes" JSONB
);

CREATE INDEX "RemediationAction_orgId_status_idx" ON "RemediationAction"("orgId", "status");

CREATE TABLE "PaymentPlanCommitment" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "discrepancyId" TEXT REFERENCES "DiscrepancyEvent"("id") ON DELETE SET NULL,
  "remediationActionId" TEXT REFERENCES "RemediationAction"("id") ON DELETE SET NULL,
  "paymentPlanRequestId" TEXT REFERENCES "PaymentPlanRequest"("id") ON DELETE SET NULL,
  "dueDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "amount" NUMERIC NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "fulfilledAt" TIMESTAMP WITH TIME ZONE,
  "metadata" JSONB
);

CREATE INDEX "PaymentPlanCommitment_orgId_status_idx" ON "PaymentPlanCommitment"("orgId", "status");
CREATE INDEX "PaymentPlanCommitment_paymentPlanRequest_idx" ON "PaymentPlanCommitment"("paymentPlanRequestId");

CREATE TABLE "TrainingSnapshot" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "discrepancyId" TEXT REFERENCES "DiscrepancyEvent"("id") ON DELETE SET NULL,
  "snapshotType" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "payload" JSONB NOT NULL
);

CREATE INDEX "TrainingSnapshot_org_snapshot_effective_idx" ON "TrainingSnapshot"("orgId", "snapshotType", "effectiveAt");
