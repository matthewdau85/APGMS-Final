-- Phase 2: Alerts, BAS cycles, and security columns

ALTER TABLE "User"
  ADD COLUMN "role" TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Alert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  CONSTRAINT "Alert_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Alert_orgId_createdAt_idx" ON "Alert"("orgId", "createdAt");
CREATE INDEX "Alert_orgId_resolvedAt_idx" ON "Alert"("orgId", "resolvedAt");

CREATE TABLE "BasCycle" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "paygwRequired" DECIMAL NOT NULL,
  "paygwSecured" DECIMAL NOT NULL,
  "gstRequired" DECIMAL NOT NULL,
  "gstSecured" DECIMAL NOT NULL,
  "overallStatus" TEXT NOT NULL,
  "lodgedAt" TIMESTAMP(3),
  CONSTRAINT "BasCycle_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BasCycle_orgId_periodStart_periodEnd_idx" ON "BasCycle"("orgId", "periodStart", "periodEnd");
CREATE INDEX "BasCycle_orgId_lodgedAt_idx" ON "BasCycle"("orgId", "lodgedAt");
