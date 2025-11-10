-- CreateEnum
CREATE TYPE "DiscrepancyEventKind" AS ENUM ('DATA_INTEGRITY', 'CONTROL_OVERRIDE', 'FRAUD_SIGNAL');

-- CreateEnum
CREATE TYPE "DiscrepancySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FraudAlertStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CLOSED');

-- CreateEnum
CREATE TYPE "RemediationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "DiscrepancyEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "busEventId" TEXT NOT NULL,
    "dedupeId" TEXT NOT NULL,
    "kind" "DiscrepancyEventKind" NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "DiscrepancySeverity" NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schemaVersion" TEXT NOT NULL,
    "orgNameSnapshot" TEXT NOT NULL,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscrepancyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudAlert" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "discrepancyId" TEXT,
    "sourceEventId" TEXT,
    "status" "FraudAlertStatus" NOT NULL DEFAULT 'OPEN',
    "riskScore" INTEGER,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationAction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "discrepancyId" TEXT,
    "fraudAlertId" TEXT,
    "sourceEventId" TEXT,
    "actionType" TEXT NOT NULL,
    "status" "RemediationStatus" NOT NULL DEFAULT 'PENDING',
    "takenBy" TEXT,
    "takenAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscrepancyEvent_busEventId_key" ON "DiscrepancyEvent"("busEventId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscrepancyEvent_dedupeId_key" ON "DiscrepancyEvent"("dedupeId");

-- CreateIndex
CREATE INDEX "DiscrepancyEvent_orgId_occurredAt_idx" ON "DiscrepancyEvent"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "DiscrepancyEvent_orgId_severity_idx" ON "DiscrepancyEvent"("orgId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "FraudAlert_sourceEventId_key" ON "FraudAlert"("sourceEventId");

-- CreateIndex
CREATE INDEX "FraudAlert_orgId_status_idx" ON "FraudAlert"("orgId", "status");

-- CreateIndex
CREATE INDEX "FraudAlert_orgId_openedAt_idx" ON "FraudAlert"("orgId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RemediationAction_sourceEventId_key" ON "RemediationAction"("sourceEventId");

-- CreateIndex
CREATE INDEX "RemediationAction_orgId_status_idx" ON "RemediationAction"("orgId", "status");

-- AddForeignKey
ALTER TABLE "DiscrepancyEvent" ADD CONSTRAINT "DiscrepancyEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_discrepancyId_fkey" FOREIGN KEY ("discrepancyId") REFERENCES "DiscrepancyEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationAction" ADD CONSTRAINT "RemediationAction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationAction" ADD CONSTRAINT "RemediationAction_discrepancyId_fkey" FOREIGN KEY ("discrepancyId") REFERENCES "DiscrepancyEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationAction" ADD CONSTRAINT "RemediationAction_fraudAlertId_fkey" FOREIGN KEY ("fraudAlertId") REFERENCES "FraudAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
