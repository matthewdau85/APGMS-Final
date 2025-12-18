-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY');

-- CreateEnum
CREATE TYPE "AccountSubtype" AS ENUM ('BANK', 'PAYGW_BUFFER', 'GST_BUFFER', 'CLEARING', 'SUSPENSE', 'RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('PAYROLL_HOLD', 'POS_GST', 'BANK_SETTLEMENT', 'BAS_RELEASE', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('PAYGW', 'GST', 'PAYGI', 'FBT', 'COMPANY', 'LCT', 'WET');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fullNameCiphertext" TEXT NOT NULL,
    "fullNameKid" TEXT NOT NULL,
    "tfnProvided" BOOLEAN NOT NULL DEFAULT false,
    "employmentType" TEXT NOT NULL,
    "baseRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "superRate" DECIMAL(5,2) NOT NULL DEFAULT 11.0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossPay" DECIMAL(12,2) NOT NULL,
    "paygWithheld" DECIMAL(12,2) NOT NULL,
    "superAccrued" DECIMAL(12,2) NOT NULL,
    "notesCiphertext" TEXT NOT NULL,
    "notesKid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subtype" "AccountSubtype",
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "seq" BIGINT NOT NULL,
    "type" "JournalType" NOT NULL,
    "eventId" TEXT NOT NULL,
    "dedupeId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "hash" TEXT,
    "prevHash" TEXT,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posting" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "memo" TEXT,

    CONSTRAINT "Posting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "asOfSeq" BIGINT NOT NULL,
    "balanceCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventEnvelope" (
    "id" TEXT NOT NULL,
    "orgId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "traceId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'processed',
    "error" TEXT,

    CONSTRAINT "EventEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "extRef" TEXT,
    "accountName" TEXT NOT NULL,
    "txDate" TIMESTAMP(3) NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "description" TEXT,
    "matchedJournalId" TEXT,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstTransaction" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "sourceRef" TEXT,
    "txDate" TIMESTAMP(3) NOT NULL,
    "netCents" BIGINT NOT NULL,
    "gstCents" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "basPeriodId" TEXT,

    CONSTRAINT "GstTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollItem" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payPeriodStart" TIMESTAMP(3) NOT NULL,
    "payPeriodEnd" TIMESTAMP(3) NOT NULL,
    "grossCents" BIGINT NOT NULL,
    "paygwCents" BIGINT NOT NULL,
    "stslCents" BIGINT NOT NULL,
    "journalId" TEXT,

    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BasPeriod" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "readyAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "lodgedAt" TIMESTAMP(3),
    "evidenceId" TEXT,

    CONSTRAINT "BasPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationAlert" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "details" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceArtifact" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "wormUri" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responsePayload" JSONB,
    "resource" TEXT,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "data" JSONB NOT NULL,
    "credentialId" TEXT,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "MfaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BasCycle" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "paygwRequired" DECIMAL(65,30) NOT NULL,
    "paygwSecured" DECIMAL(65,30) NOT NULL,
    "gstRequired" DECIMAL(65,30) NOT NULL,
    "gstSecured" DECIMAL(65,30) NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "lodgedAt" TIMESTAMP(3),

    CONSTRAINT "BasCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignatedAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignatedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignatedTransfer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignatedTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlanRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "basCycleId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "detailsJson" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentPlanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "payeeCiphertext" TEXT NOT NULL,
    "payeeKid" TEXT NOT NULL,
    "descCiphertext" TEXT NOT NULL,
    "descKid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT,

    CONSTRAINT "BankLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgTombstone" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    "prevHash" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatorSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringSnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoringSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneWayAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "balance" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "lastDepositAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneWayAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollContribution" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "actorId" TEXT,
    "idempotencyKey" TEXT,
    "appliedAt" TIMESTAMP(3),
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosTransaction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "actorId" TEXT,
    "idempotencyKey" TEXT,
    "appliedAt" TIMESTAMP(3),
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscrepancyAlert" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(24,8) NOT NULL,
    "actualAmount" DECIMAL(24,8) NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscrepancyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationObligation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BasLodgment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "initiatedBy" TEXT,
    "taxTypes" TEXT[],
    "result" JSONB,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BasLodgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferInstruction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "basId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "destination" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentSubmission" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Employee_orgId_idx" ON "Employee"("orgId");

-- CreateIndex
CREATE INDEX "PayRun_orgId_idx" ON "PayRun"("orgId");

-- CreateIndex
CREATE INDEX "Payslip_payRunId_idx" ON "Payslip"("payRunId");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE INDEX "Account_orgId_subtype_idx" ON "Account"("orgId", "subtype");

-- CreateIndex
CREATE UNIQUE INDEX "Account_orgId_code_key" ON "Account"("orgId", "code");

-- CreateIndex
CREATE INDEX "Journal_orgId_occurredAt_idx" ON "Journal"("orgId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_orgId_dedupeId_key" ON "Journal"("orgId", "dedupeId");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_orgId_seq_key" ON "Journal"("orgId", "seq");

-- CreateIndex
CREATE INDEX "Posting_orgId_accountId_idx" ON "Posting"("orgId", "accountId");

-- CreateIndex
CREATE INDEX "Posting_orgId_journalId_idx" ON "Posting"("orgId", "journalId");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceSnapshot_orgId_accountId_asOfSeq_key" ON "BalanceSnapshot"("orgId", "accountId", "asOfSeq");

-- CreateIndex
CREATE INDEX "EventEnvelope_orgId_ts_idx" ON "EventEnvelope"("orgId", "ts");

-- CreateIndex
CREATE INDEX "BankTransaction_orgId_txDate_idx" ON "BankTransaction"("orgId", "txDate");

-- CreateIndex
CREATE INDEX "GstTransaction_orgId_txDate_idx" ON "GstTransaction"("orgId", "txDate");

-- CreateIndex
CREATE INDEX "PayrollItem_orgId_employeeId_idx" ON "PayrollItem"("orgId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "BasPeriod_orgId_start_end_key" ON "BasPeriod"("orgId", "start", "end");

-- CreateIndex
CREATE INDEX "ReconciliationAlert_orgId_status_idx" ON "ReconciliationAlert"("orgId", "status");

-- CreateIndex
CREATE INDEX "EvidenceArtifact_orgId_kind_idx" ON "EvidenceArtifact"("orgId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyEntry_orgId_key_key" ON "IdempotencyEntry"("orgId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MfaCredential_credentialId_key" ON "MfaCredential"("credentialId");

-- CreateIndex
CREATE INDEX "MfaCredential_userId_type_status_idx" ON "MfaCredential"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "Alert_orgId_createdAt_idx" ON "Alert"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_orgId_resolvedAt_idx" ON "Alert"("orgId", "resolvedAt");

-- CreateIndex
CREATE INDEX "BasCycle_orgId_periodStart_periodEnd_idx" ON "BasCycle"("orgId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "BasCycle_orgId_lodgedAt_idx" ON "BasCycle"("orgId", "lodgedAt");

-- CreateIndex
CREATE INDEX "DesignatedAccount_orgId_type_idx" ON "DesignatedAccount"("orgId", "type");

-- CreateIndex
CREATE INDEX "DesignatedTransfer_orgId_accountId_createdAt_idx" ON "DesignatedTransfer"("orgId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentPlanRequest_orgId_basCycleId_idx" ON "PaymentPlanRequest"("orgId", "basCycleId");

-- CreateIndex
CREATE INDEX "PaymentPlanRequest_orgId_status_idx" ON "PaymentPlanRequest"("orgId", "status");

-- CreateIndex
CREATE INDEX "BankLine_orgId_idx" ON "BankLine"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "BankLine_orgId_idempotencyKey_key" ON "BankLine"("orgId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "RegulatorSession_orgId_createdAt_idx" ON "RegulatorSession"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "RegulatorSession_orgId_expiresAt_idx" ON "RegulatorSession"("orgId", "expiresAt");

-- CreateIndex
CREATE INDEX "MonitoringSnapshot_orgId_createdAt_idx" ON "MonitoringSnapshot"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "MonitoringSnapshot_orgId_type_createdAt_idx" ON "MonitoringSnapshot"("orgId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "OneWayAccount_taxType_idx" ON "OneWayAccount"("taxType");

-- CreateIndex
CREATE INDEX "OneWayAccount_orgId_idx" ON "OneWayAccount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OneWayAccount_orgId_taxType_key" ON "OneWayAccount"("orgId", "taxType");

-- CreateIndex
CREATE INDEX "PayrollContribution_orgId_appliedAt_idx" ON "PayrollContribution"("orgId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollContribution_orgId_idempotencyKey_key" ON "PayrollContribution"("orgId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PosTransaction_orgId_appliedAt_idx" ON "PosTransaction"("orgId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PosTransaction_orgId_idempotencyKey_key" ON "PosTransaction"("orgId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DiscrepancyAlert_orgId_taxType_idx" ON "DiscrepancyAlert"("orgId", "taxType");

-- CreateIndex
CREATE INDEX "DiscrepancyAlert_eventId_idx" ON "DiscrepancyAlert"("eventId");

-- CreateIndex
CREATE INDEX "IntegrationObligation_orgId_taxType_idx" ON "IntegrationObligation"("orgId", "taxType");

-- CreateIndex
CREATE INDEX "IntegrationObligation_eventId_idx" ON "IntegrationObligation"("eventId");

-- CreateIndex
CREATE INDEX "BasLodgment_orgId_status_idx" ON "BasLodgment"("orgId", "status");

-- CreateIndex
CREATE INDEX "TransferInstruction_orgId_taxType_idx" ON "TransferInstruction"("orgId", "taxType");

-- CreateIndex
CREATE INDEX "TransferInstruction_basId_idx" ON "TransferInstruction"("basId");

-- CreateIndex
CREATE INDEX "GovernmentSubmission_orgId_status_idx" ON "GovernmentSubmission"("orgId", "status");

-- CreateIndex
CREATE INDEX "RiskEvent_orgId_severity_resolved_idx" ON "RiskEvent"("orgId", "severity", "resolved");

-- CreateIndex
CREATE INDEX "IntegrationEvent_orgId_taxType_idx" ON "IntegrationEvent"("orgId", "taxType");

-- CreateIndex
CREATE INDEX "IntegrationEvent_taxType_idx" ON "IntegrationEvent"("taxType");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRun" ADD CONSTRAINT "PayRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payRunId_fkey" FOREIGN KEY ("payRunId") REFERENCES "PayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaCredential" ADD CONSTRAINT "MfaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasCycle" ADD CONSTRAINT "BasCycle_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignatedAccount" ADD CONSTRAINT "DesignatedAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignatedTransfer" ADD CONSTRAINT "DesignatedTransfer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignatedTransfer" ADD CONSTRAINT "DesignatedTransfer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DesignatedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlanRequest" ADD CONSTRAINT "PaymentPlanRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlanRequest" ADD CONSTRAINT "PaymentPlanRequest_basCycleId_fkey" FOREIGN KEY ("basCycleId") REFERENCES "BasCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankLine" ADD CONSTRAINT "BankLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgTombstone" ADD CONSTRAINT "OrgTombstone_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatorSession" ADD CONSTRAINT "RegulatorSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringSnapshot" ADD CONSTRAINT "MonitoringSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneWayAccount" ADD CONSTRAINT "OneWayAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollContribution" ADD CONSTRAINT "PayrollContribution_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTransaction" ADD CONSTRAINT "PosTransaction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscrepancyAlert" ADD CONSTRAINT "DiscrepancyAlert_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationObligation" ADD CONSTRAINT "IntegrationObligation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasLodgment" ADD CONSTRAINT "BasLodgment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferInstruction" ADD CONSTRAINT "TransferInstruction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentSubmission" ADD CONSTRAINT "GovernmentSubmission_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvent" ADD CONSTRAINT "RiskEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
