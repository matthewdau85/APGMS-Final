/*
  Warnings:

  - You are about to drop the `BankTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BasPeriod` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventEnvelope` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EvidenceArtifact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GstTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IdempotencyEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PayrollItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReconciliationAlert` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "BankTransaction";

-- DropTable
DROP TABLE "BasPeriod";

-- DropTable
DROP TABLE "EventEnvelope";

-- DropTable
DROP TABLE "EvidenceArtifact";

-- DropTable
DROP TABLE "GstTransaction";

-- DropTable
DROP TABLE "IdempotencyEntry";

-- DropTable
DROP TABLE "PayrollItem";

-- DropTable
DROP TABLE "ReconciliationAlert";

-- CreateTable
CREATE TABLE "TrustAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bsb" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayToAgreement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "trustAccountId" TEXT NOT NULL,
    "mandateRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "maxDebitCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayToAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementInstruction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "payToAgreementId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustAccount_orgId_idx" ON "TrustAccount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustAccount_orgId_bsb_accountNo_key" ON "TrustAccount"("orgId", "bsb", "accountNo");

-- CreateIndex
CREATE UNIQUE INDEX "PayToAgreement_mandateRef_key" ON "PayToAgreement"("mandateRef");

-- CreateIndex
CREATE INDEX "PayToAgreement_orgId_idx" ON "PayToAgreement"("orgId");

-- CreateIndex
CREATE INDEX "SettlementInstruction_orgId_period_idx" ON "SettlementInstruction"("orgId", "period");

-- CreateIndex
CREATE INDEX "SettlementInstruction_payToAgreementId_idx" ON "SettlementInstruction"("payToAgreementId");

-- AddForeignKey
ALTER TABLE "PayToAgreement" ADD CONSTRAINT "PayToAgreement_trustAccountId_fkey" FOREIGN KEY ("trustAccountId") REFERENCES "TrustAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementInstruction" ADD CONSTRAINT "SettlementInstruction_payToAgreementId_fkey" FOREIGN KEY ("payToAgreementId") REFERENCES "PayToAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
