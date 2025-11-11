-- Create enum for designated account state machine
CREATE TYPE "DesignatedAccountState" AS ENUM ('ACTIVE', 'INVESTIGATING', 'LOCKED', 'CLOSED');

-- Extend PayRun with STP control fields
ALTER TABLE "PayRun"
  ADD COLUMN "stpStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "stpSubmissionId" TEXT,
  ADD COLUMN "stpReleaseAt" TIMESTAMPTZ,
  ADD COLUMN "stpSubmittedAt" TIMESTAMPTZ,
  ADD COLUMN "stpAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stpLastAttemptAt" TIMESTAMPTZ;

CREATE INDEX "PayRun_orgId_stpStatus_idx" ON "PayRun"("orgId", "stpStatus");

-- Extend BAS period with filing telemetry
ALTER TABLE "BasPeriod"
  ADD COLUMN "lodgementAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lodgementLastAttemptAt" TIMESTAMPTZ,
  ADD COLUMN "escrowVerifiedAt" TIMESTAMPTZ;

CREATE INDEX "BasPeriod_orgId_status_idx" ON "BasPeriod"("orgId", "status");

-- Designated account state transitions
CREATE TABLE "DesignatedAccountStateTransition" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "fromState" "DesignatedAccountState",
  "toState" "DesignatedAccountState" NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "DesignatedAccountStateTransition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE,
  CONSTRAINT "DesignatedAccountStateTransition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DesignatedAccount"("id") ON DELETE CASCADE
);

CREATE INDEX "DesignatedAccountStateTransition_orgId_accountId_createdAt_idx" ON "DesignatedAccountStateTransition"("orgId", "accountId", "createdAt");
CREATE INDEX "DesignatedAccountStateTransition_orgId_toState_idx" ON "DesignatedAccountStateTransition"("orgId", "toState");

-- Designated reconciliation snapshots
CREATE TABLE "DesignatedReconciliationSnapshot" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "paygwBalance" NUMERIC NOT NULL,
  "gstBalance" NUMERIC NOT NULL,
  "payload" JSONB NOT NULL,
  "sha256" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "evidenceArtifactId" UUID,
  CONSTRAINT "DesignatedReconciliationSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE,
  CONSTRAINT "DesignatedReconciliationSnapshot_evidenceArtifactId_fkey" FOREIGN KEY ("evidenceArtifactId") REFERENCES "EvidenceArtifact"("id") ON DELETE SET NULL
);

CREATE INDEX "DesignatedReconciliationSnapshot_orgId_generatedAt_idx" ON "DesignatedReconciliationSnapshot"("orgId", "generatedAt");
CREATE INDEX "DesignatedReconciliationSnapshot_orgId_sha256_idx" ON "DesignatedReconciliationSnapshot"("orgId", "sha256");

-- Designated violation flags
CREATE TABLE "DesignatedViolationFlag" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "accountId" TEXT,
  "code" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "resolvedAt" TIMESTAMPTZ,
  "metadata" JSONB,
  "auditLogId" TEXT,
  CONSTRAINT "DesignatedViolationFlag_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE,
  CONSTRAINT "DesignatedViolationFlag_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DesignatedAccount"("id") ON DELETE SET NULL,
  CONSTRAINT "DesignatedViolationFlag_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE SET NULL
);

CREATE INDEX "DesignatedViolationFlag_orgId_status_idx" ON "DesignatedViolationFlag"("orgId", "status");
CREATE INDEX "DesignatedViolationFlag_orgId_code_status_idx" ON "DesignatedViolationFlag"("orgId", "code", "status");

-- Immutable audit log seals
CREATE TABLE "AuditLogSeal" (
  "id" TEXT PRIMARY KEY,
  "auditLogId" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "sealedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "sealedBy" TEXT NOT NULL,
  CONSTRAINT "AuditLogSeal_auditLogId_key" UNIQUE ("auditLogId"),
  CONSTRAINT "AuditLogSeal_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE CASCADE
);
