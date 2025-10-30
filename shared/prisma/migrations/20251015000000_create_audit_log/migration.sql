-- Create AuditLog table (baseline for later alterations)
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_orgId_createdAt_idx"
  ON "AuditLog"("orgId", "createdAt");

CREATE INDEX "AuditLog_actorId_createdAt_idx"
  ON "AuditLog"("actorId", "createdAt");
