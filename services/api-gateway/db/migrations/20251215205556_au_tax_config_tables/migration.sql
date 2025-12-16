-- CreateEnum
CREATE TYPE "AuTaxType" AS ENUM ('PAYGW', 'GST', 'HELP', 'STSL');

-- CreateEnum
CREATE TYPE "AuTaxRateTableKind" AS ENUM ('PAYGW_WITHHOLDING', 'GST_RULES', 'HELP_STSL_SCHEDULE');

-- CreateEnum
CREATE TYPE "TaxConfigStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuTaxParameterSet" (
    "id" TEXT NOT NULL,
    "taxType" "AuTaxType" NOT NULL,
    "status" "TaxConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "sourceName" TEXT NOT NULL,
    "sourceRef" TEXT,
    "sourceHash" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuTaxParameterSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuTaxRateTable" (
    "id" TEXT NOT NULL,
    "parameterSetId" TEXT NOT NULL,
    "kind" "AuTaxRateTableKind" NOT NULL,
    "name" TEXT,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuTaxRateTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuTaxRuleChange" (
    "id" TEXT NOT NULL,
    "taxType" "AuTaxType" NOT NULL,
    "kind" "AuTaxRateTableKind" NOT NULL,
    "oldParameterSetId" TEXT,
    "newParameterSetId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "diffSummary" JSONB,
    "sourceRef" TEXT,
    "sourceHash" TEXT NOT NULL,
    "appliedBy" TEXT NOT NULL DEFAULT 'system',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuTaxRuleChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuTaxParameterSet_taxType_effectiveFrom_effectiveTo_idx" ON "AuTaxParameterSet"("taxType", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "AuTaxParameterSet_taxType_effectiveFrom_key" ON "AuTaxParameterSet"("taxType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "AuTaxRateTable_kind_idx" ON "AuTaxRateTable"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "AuTaxRateTable_parameterSetId_kind_key" ON "AuTaxRateTable"("parameterSetId", "kind");

-- CreateIndex
CREATE INDEX "AuTaxRuleChange_taxType_kind_effectiveFrom_idx" ON "AuTaxRuleChange"("taxType", "kind", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuTaxRateTable" ADD CONSTRAINT "AuTaxRateTable_parameterSetId_fkey" FOREIGN KEY ("parameterSetId") REFERENCES "AuTaxParameterSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuTaxRuleChange" ADD CONSTRAINT "AuTaxRuleChange_oldParameterSetId_fkey" FOREIGN KEY ("oldParameterSetId") REFERENCES "AuTaxParameterSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuTaxRuleChange" ADD CONSTRAINT "AuTaxRuleChange_newParameterSetId_fkey" FOREIGN KEY ("newParameterSetId") REFERENCES "AuTaxParameterSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
