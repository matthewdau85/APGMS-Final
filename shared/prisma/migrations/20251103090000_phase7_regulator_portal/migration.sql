-- Phase 7: regulator workspace foundation

ALTER TABLE "AuditLog"
  ADD COLUMN "hash" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "prevHash" TEXT;

CREATE TABLE "RegulatorSession" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "issuedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "lastUsedAt" TIMESTAMP WITH TIME ZONE,
  "revokedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "RegulatorSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE
);

CREATE INDEX "RegulatorSession_orgId_createdAt_idx"
  ON "RegulatorSession" ("orgId", "createdAt");

CREATE INDEX "RegulatorSession_orgId_expiresAt_idx"
  ON "RegulatorSession" ("orgId", "expiresAt");

CREATE TABLE "MonitoringSnapshot" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "MonitoringSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE
);

CREATE INDEX "MonitoringSnapshot_orgId_createdAt_idx"
  ON "MonitoringSnapshot" ("orgId", "createdAt");

CREATE INDEX "MonitoringSnapshot_orgId_type_createdAt_idx"
  ON "MonitoringSnapshot" ("orgId", "type", "createdAt");
