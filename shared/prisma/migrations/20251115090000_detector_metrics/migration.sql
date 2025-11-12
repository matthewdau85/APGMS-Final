-- Detector concentration metrics storage

CREATE TABLE "Metric" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "scope" TEXT,
  "data" JSONB NOT NULL,
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Metric_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE
);

CREATE INDEX "Metric_orgId_key_recordedAt_idx"
  ON "Metric" ("orgId", "key", "recordedAt" DESC);

CREATE INDEX "Metric_orgId_scope_key_idx"
  ON "Metric" ("orgId", "scope", "key");
