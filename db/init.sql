-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Orgs (tenants)
CREATE TABLE "Org" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3)
);

-- Users (belong to org)
CREATE TABLE "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Bank lines (ledger-like entries)
CREATE TABLE "BankLine" (
    "id" TEXT PRIMARY KEY,
    "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "idempotencyKey" TEXT,
    "payeeCiphertext" TEXT NOT NULL,
    "payeeKid" TEXT NOT NULL,
    "descCiphertext" TEXT NOT NULL,
    "descKid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "BankLine_orgId_idempotencyKey_key"
  ON "BankLine"("orgId","idempotencyKey");

CREATE INDEX "BankLine_orgId_idx"
  ON "BankLine"("orgId");

-- Alerts (org-scoped)
CREATE TABLE "Alert" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT
);

CREATE INDEX "Alert_orgId_createdAt_idx"
  ON "Alert"("orgId","createdAt");

CREATE INDEX "Alert_orgId_resolvedAt_idx"
  ON "Alert"("orgId","resolvedAt");

-- BAS cycles
CREATE TABLE "BasCycle" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "paygwRequired" DECIMAL(65,30) NOT NULL,
  "paygwSecured" DECIMAL(65,30) NOT NULL,
  "gstRequired" DECIMAL(65,30) NOT NULL,
  "gstSecured" DECIMAL(65,30) NOT NULL,
  "overallStatus" TEXT NOT NULL,
  "lodgedAt" TIMESTAMP(3)
);

CREATE INDEX "BasCycle_orgId_periodStart_periodEnd_idx"
  ON "BasCycle"("orgId","periodStart","periodEnd");

CREATE INDEX "BasCycle_orgId_lodgedAt_idx"
  ON "BasCycle"("orgId","lodgedAt");

-- Designated holding accounts
CREATE TABLE "DesignatedAccount" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "DesignatedAccount_orgId_type_idx"
  ON "DesignatedAccount"("orgId","type");

CREATE TABLE "DesignatedTransfer" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accountId" TEXT NOT NULL REFERENCES "DesignatedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "amount" DECIMAL(65,30) NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "DesignatedTransfer_orgId_accountId_createdAt_idx"
  ON "DesignatedTransfer"("orgId","accountId","createdAt");

-- Audit log
CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "orgId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX "AuditLog_orgId_createdAt_idx"
  ON "AuditLog" ("orgId", "createdAt");

CREATE INDEX "AuditLog_actorId_createdAt_idx"
  ON "AuditLog" ("actorId", "createdAt");

-- Seed tenant/org
INSERT INTO "Org" ("id","name")
VALUES ('dev-org','Dev Org');

-- Seed admin user (email/password/org)
-- password = admin123
INSERT INTO "User" ("id","email","password","role","mfaEnabled","orgId")
VALUES (
  'dev-user',
  'dev@example.com',
  '$2b$10$4gvkcorFZMycBNLGdDHYHuo2tnOzqB4M6mvEZhzA03Z2zLjxD9ArK',
  'admin',
  false,
  'dev-org'
);

-- Seed a live BAS cycle with PAYGW shortfall but GST ready
INSERT INTO "BasCycle" (
  "id",
  "orgId",
  "periodStart",
  "periodEnd",
  "paygwRequired",
  "paygwSecured",
  "gstRequired",
  "gstSecured",
  "overallStatus"
) VALUES (
  'cycle-2025-10',
  'dev-org',
  TIMESTAMP '2025-10-01 00:00:00',
  TIMESTAMP '2025-10-31 00:00:00',
  12345.67,
  12000.00,
  9876.54,
  9876.54,
  'BLOCKED'
);

-- Seed designated accounts and recent transfers
INSERT INTO "DesignatedAccount" ("id","orgId","type","balance","updatedAt") VALUES
  ('acct-paygw-dev','dev-org','PAYGW',12000.00,CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
  ('acct-gst-dev','dev-org','GST',9876.54,CURRENT_TIMESTAMP - INTERVAL '15 minutes');

INSERT INTO "DesignatedTransfer" ("id","orgId","accountId","amount","source","createdAt") VALUES
  ('xfer-paygw-1','dev-org','acct-paygw-dev',6000.00,'PAYROLL_CAPTURE',CURRENT_TIMESTAMP - INTERVAL '3 days'),
  ('xfer-paygw-2','dev-org','acct-paygw-dev',6000.00,'MANUAL_TOP_UP',CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('xfer-gst-1','dev-org','acct-gst-dev',9876.54,'GST_CAPTURE',CURRENT_TIMESTAMP - INTERVAL '18 hours');

-- Seed alerts referencing the shortfalls
INSERT INTO "Alert" (
  "id",
  "orgId",
  "type",
  "severity",
  "message",
  "createdAt"
) VALUES
  (
    'alrt-gst-short',
    'dev-org',
    'GST_SHORTFALL',
    'HIGH',
    'GST secured is lower than GST calculated for 16 Oct.',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
  ),
  (
    'alrt-paygw-short',
    'dev-org',
    'PAYGW_SHORTFALL',
    'MEDIUM',
    'PAYGW holding account is short of the required amount.',
    CURRENT_TIMESTAMP - INTERVAL '12 hours'
  );

-- no seed rows for BankLine; you'll add via POST /bank-lines after login

-- bring in payroll tables
\i /docker-entrypoint-initdb.d/payroll.sql
