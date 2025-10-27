-- enable crypto extension (safe if already exists)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Orgs
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- 2. Users (belongs to Org)
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "User"
ADD CONSTRAINT "User_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Org"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. BankLine (ledger lines, encrypted payee/desc)
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

ALTER TABLE "BankLine"
ADD CONSTRAINT "BankLine_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Org"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- indexes from your migrations
CREATE UNIQUE INDEX "BankLine_orgId_idempotencyKey_key"
    ON "BankLine"("orgId", "idempotencyKey");

CREATE INDEX "BankLine_orgId_idx"
    ON "BankLine"("orgId");

-- 4. OrgTombstone (archive of deleted orgs)
CREATE TABLE "OrgTombstone" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgTombstone_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrgTombstone"
ADD CONSTRAINT "OrgTombstone_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Org"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. AuditLog
-- Note: after your later migration, "id" no longer has a default,
-- and "createdAt" is TIMESTAMP(3) not timestamptz.
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_orgId_createdAt_idx"
    ON "AuditLog" ("orgId", "createdAt");

CREATE INDEX "AuditLog_actorId_createdAt_idx"
    ON "AuditLog" ("actorId", "createdAt");


-------------------------------------------------
-- Seed data for local/dev admin org + admin user
-------------------------------------------------

INSERT INTO "Org" ("id", "name")
VALUES ('dev-org', 'Dev Org');

-- password hash is a placeholder for now
-- we'll replace this with a bcrypt hash later
INSERT INTO "User" ("id", "email", "password", "orgId")
VALUES ('dev-user', 'dev@example.com', 'not-a-real-hash', 'dev-org');

-- (optional) no BankLine rows yet
-- INSERT INTO "BankLine" (...) VALUES (...);

-- done
