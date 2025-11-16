-- Forecast snapshot persistence for predictive auditability.
CREATE TABLE "ForecastSnapshot" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paygwForecast" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "gstForecast" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "method" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ForecastSnapshot_orgId_snapshotDate_idx"
  ON "ForecastSnapshot"("orgId","snapshotDate" DESC);
