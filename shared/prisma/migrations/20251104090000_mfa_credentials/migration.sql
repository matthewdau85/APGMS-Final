-- CreateTable
CREATE TABLE "MfaCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "data" JSONB NOT NULL,
    "credentialId" TEXT,
    "primary" BOOLEAN NOT NULL DEFAULT FALSE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ,
    CONSTRAINT "MfaCredential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MfaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "MfaCredential_credentialId_key" ON "MfaCredential"("credentialId") WHERE "credentialId" IS NOT NULL;
CREATE INDEX "MfaCredential_userId_type_status_idx" ON "MfaCredential"("userId", "type", "status");
