CREATE TABLE "PayrollContribution" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "amount" NUMERIC(20,2) NOT NULL,
  "source" TEXT NOT NULL,
  "payload" JSONB,
  "actorId" TEXT,
  "idempotencyKey" TEXT,
  "appliedAt" TIMESTAMP,
  "transferId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "PayrollContribution_orgId_idempotencyKey_key" ON "PayrollContribution" ("orgId", "idempotencyKey");
CREATE INDEX "PayrollContribution_orgId_appliedAt_idx" ON "PayrollContribution" ("orgId", "appliedAt");

CREATE TABLE "PosTransaction" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "amount" NUMERIC(20,2) NOT NULL,
  "source" TEXT NOT NULL,
  "payload" JSONB,
  "actorId" TEXT,
  "idempotencyKey" TEXT,
  "appliedAt" TIMESTAMP,
  "transferId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "PosTransaction_orgId_idempotencyKey_key" ON "PosTransaction" ("orgId", "idempotencyKey");
CREATE INDEX "PosTransaction_orgId_appliedAt_idx" ON "PosTransaction" ("orgId", "appliedAt");
