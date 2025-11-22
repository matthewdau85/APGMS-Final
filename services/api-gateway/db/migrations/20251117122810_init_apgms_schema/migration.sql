-- CreateEnum
CREATE TYPE "Schedule" AS ENUM ('MONTHLY', 'QUARTERLY');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "abn" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "schedule" "Schedule" NOT NULL DEFAULT 'QUARTERLY',
    "shortfallThresholdBps" INTEGER NOT NULL DEFAULT 500,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignatedAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mandateId" TEXT,
    "displayName" TEXT,

    CONSTRAINT "DesignatedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObligationHistory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "cents" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObligationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_abn_key" ON "Organization"("abn");

-- CreateIndex
CREATE UNIQUE INDEX "DesignatedAccount_orgId_type_key" ON "DesignatedAccount"("orgId", "type");

-- CreateIndex
CREATE INDEX "ObligationHistory_orgId_type_period_idx" ON "ObligationHistory"("orgId", "type", "period");

-- AddForeignKey
ALTER TABLE "DesignatedAccount" ADD CONSTRAINT "DesignatedAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObligationHistory" ADD CONSTRAINT "ObligationHistory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
