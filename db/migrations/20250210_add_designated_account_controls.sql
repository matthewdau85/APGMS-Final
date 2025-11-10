-- Migration: add designated account state tracking, reconciliation snapshots and deposit-only audit logs

-- Enum for designated account lifecycle states
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'DesignatedAccountStatus'
  ) THEN
    CREATE TYPE "DesignatedAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LOCKED', 'CLOSED');
  END IF;
END $$;

-- State history table
CREATE TABLE IF NOT EXISTS "DesignatedAccountState" (
  "id"            TEXT PRIMARY KEY,
  "accountId"     TEXT NOT NULL REFERENCES "DesignatedAccount"("id") ON DELETE CASCADE,
  "orgId"         TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "status"        "DesignatedAccountStatus" NOT NULL,
  "reason"        TEXT NULL,
  "actorId"       TEXT NULL,
  "effectiveAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "DesignatedAccountState_accountId_effectiveAt_idx"
  ON "DesignatedAccountState" ("accountId", "effectiveAt");
CREATE INDEX IF NOT EXISTS "DesignatedAccountState_orgId_status_idx"
  ON "DesignatedAccountState" ("orgId", "status");

-- Deposit audit log (enforces positive deposits)
CREATE TABLE IF NOT EXISTS "DesignatedAccountDepositLog" (
  "id"            TEXT PRIMARY KEY,
  "orgId"         TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "accountId"     TEXT NOT NULL REFERENCES "DesignatedAccount"("id") ON DELETE CASCADE,
  "depositCents"  BIGINT NOT NULL,
  "recordedBy"    TEXT NOT NULL,
  "reference"     TEXT NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "hash"          TEXT NOT NULL,
  "prevHash"      TEXT NULL,
  CONSTRAINT "DesignatedAccountDepositLog_positive_amount"
    CHECK ("depositCents" > 0)
);
CREATE INDEX IF NOT EXISTS "DesignatedAccountDepositLog_orgId_accountId_createdAt_idx"
  ON "DesignatedAccountDepositLog" ("orgId", "accountId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "DesignatedAccountDepositLog_orgId_hash_key"
  ON "DesignatedAccountDepositLog" ("orgId", "hash");

-- Reconciliation snapshots capture ledger vs bank balances at a point in time
CREATE TABLE IF NOT EXISTS "ReconciliationSnapshot" (
  "id"                  TEXT PRIMARY KEY,
  "orgId"               TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "scope"               TEXT NOT NULL,
  "periodStart"         TIMESTAMPTZ NOT NULL,
  "periodEnd"           TIMESTAMPTZ NOT NULL,
  "ledgerBalanceCents"  BIGINT NOT NULL,
  "bankBalanceCents"    BIGINT NOT NULL,
  "varianceCents"       BIGINT NOT NULL,
  "preparedBy"          TEXT NULL,
  "evidenceArtifactId"  TEXT NULL,
  "lockedAt"            TIMESTAMPTZ NULL,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ReconciliationSnapshot_orgId_periodEnd_idx"
  ON "ReconciliationSnapshot" ("orgId", "periodEnd");
CREATE INDEX IF NOT EXISTS "ReconciliationSnapshot_orgId_scope_period_idx"
  ON "ReconciliationSnapshot" ("orgId", "scope", "periodStart", "periodEnd");

-- Audit logs already include hashes; ensure uniqueness by orgId+hash
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'AuditLog_orgId_hash_key'
  ) THEN
    CREATE UNIQUE INDEX "AuditLog_orgId_hash_key" ON "AuditLog" ("orgId", "hash");
  END IF;
END $$;

