CREATE EXTENSION IF NOT EXISTS "pgcrypto";
ALTER TABLE "BankLine" ADD COLUMN "payeeCiphertext" TEXT;
ALTER TABLE "BankLine" ADD COLUMN "payeeKid" TEXT;
ALTER TABLE "BankLine" ADD COLUMN "descCiphertext" TEXT;
ALTER TABLE "BankLine" ADD COLUMN "descKid" TEXT;

UPDATE "BankLine"
SET
  "payeeCiphertext" = COALESCE("payee", ''),
  "payeeKid" = 'legacy',
  "descCiphertext" = COALESCE("desc", ''),
  "descKid" = 'legacy';

ALTER TABLE "BankLine" DROP COLUMN "payee";
ALTER TABLE "BankLine" DROP COLUMN "desc";

ALTER TABLE "BankLine"
  ALTER COLUMN "payeeCiphertext" SET NOT NULL,
  ALTER COLUMN "payeeKid" SET NOT NULL,
  ALTER COLUMN "descCiphertext" SET NOT NULL,
  ALTER COLUMN "descKid" SET NOT NULL;

DO $$
BEGIN
  CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "AuditLog_orgId_createdAt_idx" ON "AuditLog" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog" ("actorId", "createdAt");
