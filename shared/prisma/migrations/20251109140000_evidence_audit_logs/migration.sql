CREATE TABLE "EvidenceAudit" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orgId" UUID NOT NULL,
  "artifactId" UUID NOT NULL REFERENCES "EvidenceArtifact"("id") ON DELETE CASCADE,
  "requesterId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "EvidenceAudit_artifactId_createdAt_idx" ON "EvidenceAudit" ("artifactId", "createdAt");
CREATE INDEX "EvidenceAudit_orgId_createdAt_idx" ON "EvidenceAudit" ("orgId", "createdAt");
