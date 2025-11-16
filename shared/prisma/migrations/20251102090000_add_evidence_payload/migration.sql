-- Ensure the EvidenceArtifact table exists before adding payload metadata
CREATE TABLE IF NOT EXISTS "EvidenceArtifact" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orgId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "wormUri" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add payload JSON column to store captured evidence snapshots
ALTER TABLE "EvidenceArtifact"
ADD COLUMN "payload" JSONB;
