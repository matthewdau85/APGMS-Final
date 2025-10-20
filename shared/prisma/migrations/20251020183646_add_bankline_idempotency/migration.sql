/*
  Warnings:

  - A unique constraint covering the columns `[orgId,idempotencyKey]` on the table `BankLine` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BankLine" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BankLine_orgId_idempotencyKey_key" ON "BankLine"("orgId", "idempotencyKey");
