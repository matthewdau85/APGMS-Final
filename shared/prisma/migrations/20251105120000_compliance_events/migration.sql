-- Compliance events and remediation tables

CREATE TABLE "DiscrepancyEvent" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "orgNameSnapshot" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "source" TEXT NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "context" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "DiscrepancyEvent_orgId_detectedAt_idx"
  ON "DiscrepancyEvent"("orgId","detectedAt");

CREATE INDEX "DiscrepancyEvent_orgId_status_idx"
  ON "DiscrepancyEvent"("orgId","status");

CREATE TABLE "FraudAlert" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "orgNameSnapshot" TEXT NOT NULL,
  "discrepancyEventId" TEXT REFERENCES "DiscrepancyEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "alertType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "details" JSONB NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "FraudAlert_orgId_status_idx"
  ON "FraudAlert"("orgId","status");

CREATE INDEX "FraudAlert_orgId_triggeredAt_idx"
  ON "FraudAlert"("orgId","triggeredAt");

CREATE TABLE "RemediationAction" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "orgNameSnapshot" TEXT NOT NULL,
  "discrepancyEventId" TEXT REFERENCES "DiscrepancyEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "fraudAlertId" TEXT REFERENCES "FraudAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "actionType" TEXT NOT NULL,
  "owner" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "RemediationAction_orgId_status_idx"
  ON "RemediationAction"("orgId","status");

CREATE INDEX "RemediationAction_orgId_dueAt_idx"
  ON "RemediationAction"("orgId","dueAt");

CREATE TABLE "PaymentPlanAgreement" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "orgNameSnapshot" TEXT NOT NULL,
  "paymentPlanRequestId" TEXT REFERENCES "PaymentPlanRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "discrepancyEventId" TEXT REFERENCES "DiscrepancyEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "basCycleId" TEXT REFERENCES "BasCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "authority" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "terms" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PaymentPlanAgreement_orgId_status_idx"
  ON "PaymentPlanAgreement"("orgId","status");

CREATE INDEX "PaymentPlanAgreement_orgId_startDate_idx"
  ON "PaymentPlanAgreement"("orgId","startDate");

CREATE INDEX "PaymentPlanAgreement_orgId_basCycleId_idx"
  ON "PaymentPlanAgreement"("orgId","basCycleId");
