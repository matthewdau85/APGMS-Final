-- Designated accounts & reconciliation instrumentation
CREATE TYPE "DesignatedAccountStatus" AS ENUM ('ACTIVE', 'VIOLATION', 'SUSPENDED', 'RECONCILED');
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'IN_BALANCE', 'OUT_OF_BALANCE', 'FAILED');
CREATE TYPE "RemittanceStatus" AS ENUM ('QUEUED', 'DISPATCHED', 'SETTLED', 'FAILED');

ALTER TABLE "AuditLog"
  ADD COLUMN "chainSeq" BIGSERIAL,
  ADD COLUMN "signature" TEXT;

ALTER TABLE "AuditLog"
  ALTER COLUMN "hash" SET NOT NULL;

CREATE UNIQUE INDEX "AuditLog_orgId_chainSeq_key"
  ON "AuditLog" ("orgId", "chainSeq");

CREATE TABLE "DesignatedAccountState" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "status" "DesignatedAccountStatus" NOT NULL,
  "reason" TEXT,
  "context" JSONB,
  "actorId" TEXT NOT NULL,
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "DesignatedAccountState_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE,
  CONSTRAINT "DesignatedAccountState_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DesignatedAccount"("id") ON DELETE CASCADE
);

CREATE INDEX "DesignatedAccountState_orgId_accountId_recordedAt_idx"
  ON "DesignatedAccountState" ("orgId", "accountId", "recordedAt");

CREATE INDEX "DesignatedAccountState_accountId_status_idx"
  ON "DesignatedAccountState" ("accountId", "status");

CREATE TABLE "DesignatedAccountReconciliationSnapshot" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "accountId" TEXT,
  "artifactId" TEXT,
  "capturedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
  "externalBalance" DECIMAL(18,2),
  "internalBalance" DECIMAL(18,2) NOT NULL,
  "variance" DECIMAL(18,2),
  "details" JSONB,
  CONSTRAINT "DesignatedAccountReconciliationSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE,
  CONSTRAINT "DesignatedAccountReconciliationSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DesignatedAccount"("id") ON DELETE SET NULL,
  CONSTRAINT "DesignatedAccountReconciliationSnapshot_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "EvidenceArtifact"("id") ON DELETE SET NULL
);

CREATE INDEX "DesignatedAccountReconciliationSnapshot_orgId_capturedAt_idx"
  ON "DesignatedAccountReconciliationSnapshot" ("orgId", "capturedAt");

CREATE INDEX "DesignatedAccountReconciliationSnapshot_accountId_capturedAt_idx"
  ON "DesignatedAccountReconciliationSnapshot" ("accountId", "capturedAt");

CREATE TABLE "ScheduledRemittance" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "bankLineId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "purpose" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'npp',
  "status" "RemittanceStatus" NOT NULL DEFAULT 'QUEUED',
  "scheduledFor" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMPTZ,
  "dispatchedAt" TIMESTAMPTZ,
  "settlementRef" TEXT,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ScheduledRemittance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE,
  CONSTRAINT "ScheduledRemittance_bankLineId_fkey" FOREIGN KEY ("bankLineId") REFERENCES "BankLine"("id") ON DELETE SET NULL
);

CREATE INDEX "ScheduledRemittance_orgId_status_scheduledFor_idx"
  ON "ScheduledRemittance" ("orgId", "status", "scheduledFor");

CREATE UNIQUE INDEX "ScheduledRemittance_bankLineId_key"
  ON "ScheduledRemittance" ("bankLineId")
  WHERE "bankLineId" IS NOT NULL;

CREATE UNIQUE INDEX "ScheduledRemittance_reference_idx"
  ON "ScheduledRemittance" ("referenceType", "referenceId")
  WHERE "referenceType" IS NOT NULL AND "referenceId" IS NOT NULL;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_scheduled_remittance_updated_at ON "ScheduledRemittance";
CREATE TRIGGER set_scheduled_remittance_updated_at
BEFORE UPDATE ON "ScheduledRemittance"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
