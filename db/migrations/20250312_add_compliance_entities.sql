CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertStatus') THEN
    CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKED', 'CLOSED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "Discrepancy" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orgId" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "summary" TEXT NOT NULL,
  "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolvedAt" TIMESTAMPTZ,
  "amountCents" BIGINT,
  "details" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "Discrepancy"
  ADD CONSTRAINT IF NOT EXISTS "Discrepancy_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Discrepancy_orgId_status_idx"
  ON "Discrepancy" ("orgId", "status");

CREATE INDEX IF NOT EXISTS "Discrepancy_orgId_detectedAt_idx"
  ON "Discrepancy" ("orgId", "detectedAt");

CREATE TABLE IF NOT EXISTS "FraudAlert" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orgId" UUID NOT NULL,
  "discrepancyId" UUID,
  "alertCode" TEXT NOT NULL,
  "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
  "severity" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "raisedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "acknowledgedAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ,
  "metadata" JSONB
);

ALTER TABLE "FraudAlert"
  ADD CONSTRAINT IF NOT EXISTS "FraudAlert_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE;

ALTER TABLE "FraudAlert"
  ADD CONSTRAINT IF NOT EXISTS "FraudAlert_discrepancyId_fkey"
    FOREIGN KEY ("discrepancyId") REFERENCES "Discrepancy"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "FraudAlert_orgId_alertCode_key"
  ON "FraudAlert" ("orgId", "alertCode");

CREATE INDEX IF NOT EXISTS "FraudAlert_orgId_status_idx"
  ON "FraudAlert" ("orgId", "status");

CREATE INDEX IF NOT EXISTS "FraudAlert_orgId_discrepancyId_idx"
  ON "FraudAlert" ("orgId", "discrepancyId");

CREATE TABLE IF NOT EXISTS "RemediationAction" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orgId" UUID NOT NULL,
  "discrepancyId" UUID,
  "fraudAlertId" UUID,
  "actionType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "assignedTo" TEXT,
  "dueAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "RemediationAction"
  ADD CONSTRAINT IF NOT EXISTS "RemediationAction_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE;

ALTER TABLE "RemediationAction"
  ADD CONSTRAINT IF NOT EXISTS "RemediationAction_discrepancyId_fkey"
    FOREIGN KEY ("discrepancyId") REFERENCES "Discrepancy"("id") ON DELETE SET NULL;

ALTER TABLE "RemediationAction"
  ADD CONSTRAINT IF NOT EXISTS "RemediationAction_fraudAlertId_fkey"
    FOREIGN KEY ("fraudAlertId") REFERENCES "FraudAlert"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "RemediationAction_orgId_status_idx"
  ON "RemediationAction" ("orgId", "status");

CREATE INDEX IF NOT EXISTS "RemediationAction_orgId_dueAt_idx"
  ON "RemediationAction" ("orgId", "dueAt");

CREATE TABLE IF NOT EXISTS "PaymentPlanAgreement" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orgId" UUID NOT NULL,
  "discrepancyId" UUID,
  "fraudAlertId" UUID,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "agreedAt" TIMESTAMPTZ,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "paymentFrequency" TEXT,
  "totalAmountCents" BIGINT,
  "terms" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "PaymentPlanAgreement"
  ADD CONSTRAINT IF NOT EXISTS "PaymentPlanAgreement_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE;

ALTER TABLE "PaymentPlanAgreement"
  ADD CONSTRAINT IF NOT EXISTS "PaymentPlanAgreement_discrepancyId_fkey"
    FOREIGN KEY ("discrepancyId") REFERENCES "Discrepancy"("id") ON DELETE SET NULL;

ALTER TABLE "PaymentPlanAgreement"
  ADD CONSTRAINT IF NOT EXISTS "PaymentPlanAgreement_fraudAlertId_fkey"
    FOREIGN KEY ("fraudAlertId") REFERENCES "FraudAlert"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "PaymentPlanAgreement_orgId_status_idx"
  ON "PaymentPlanAgreement" ("orgId", "status");

CREATE INDEX IF NOT EXISTS "PaymentPlanAgreement_orgId_discrepancyId_idx"
  ON "PaymentPlanAgreement" ("orgId", "discrepancyId");
