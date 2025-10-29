-- Phase 3: Designated holding accounts and transfers

CREATE TABLE "DesignatedAccount" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "balance" DECIMAL NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesignatedAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DesignatedAccount_orgId_type_idx"
  ON "DesignatedAccount"("orgId","type");

CREATE TABLE "DesignatedTransfer" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesignatedTransfer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DesignatedTransfer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DesignatedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DesignatedTransfer_orgId_accountId_createdAt_idx"
  ON "DesignatedTransfer"("orgId","accountId","createdAt");
