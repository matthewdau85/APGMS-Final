ALTER TABLE "MonitoringSnapshot"
  ADD COLUMN "computeVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN "populationNote" TEXT,
  ADD COLUMN "consecutivePeriods" INTEGER,
  ADD COLUMN "isMuted" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "mutedReason" TEXT,
  ADD COLUMN "spikes" JSONB;
