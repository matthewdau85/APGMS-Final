-- Add payload JSON column to store captured evidence snapshots
ALTER TABLE "EvidenceArtifact"
ADD COLUMN "payload" JSONB;
