ALTER TABLE "Org"
ADD COLUMN "securingSchedule" TEXT NOT NULL DEFAULT 'weekly';

ALTER TABLE "DiscrepancyAlert"
ADD COLUMN "resolvedAt" TIMESTAMPTZ,
ADD COLUMN "resolvedBy" TEXT,
ADD COLUMN "resolutionType" TEXT,
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "resolutionPayload" JSONB;
