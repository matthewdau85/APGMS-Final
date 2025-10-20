-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrgTombstone" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgTombstone_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrgTombstone" ADD CONSTRAINT "OrgTombstone_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
