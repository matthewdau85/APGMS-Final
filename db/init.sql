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
INSERT INTO "User" ("id","email","password","orgId")
VALUES (
  'dev-user',
  'dev@example.com',
  '$2b$10$4gvkcorFZMycBNLGdDHYHuo2tnOzqB4M6mvEZhzA03Z2zLjxD9ArK',
  'dev-org'
);

-- no seed rows for BankLine; you'll add via POST /bank-lines after login

-- bring in payroll tables
\i /docker-entrypoint-initdb.d/payroll.sql
