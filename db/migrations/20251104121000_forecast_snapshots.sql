-- Forecast snapshots persist the predictive engine outputs for auditability.
CREATE TABLE IF NOT EXISTS "ForecastSnapshot" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "snapshotDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "paygwForecast" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "gstForecast" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "method" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ForecastSnapshot_orgId_snapshotDate_idx"
  ON "ForecastSnapshot"("orgId", "snapshotDate" DESC);
