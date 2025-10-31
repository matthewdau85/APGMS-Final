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

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyEntry_orgId_key_key" ON "IdempotencyEntry"("orgId", "key");
