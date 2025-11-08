CREATE TABLE "AnalyticsEvent" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL,
  "labels" JSONB,
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AnalyticsEvent_orgId_occurredAt_idx"
  ON "AnalyticsEvent" ("orgId", "occurredAt");

CREATE INDEX "AnalyticsEvent_domain_eventType_occurredAt_idx"
  ON "AnalyticsEvent" ("domain", "eventType", "occurredAt");

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AnalyticsFeatureSnapshot" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "asOf" TIMESTAMP(3) NOT NULL,
  "features" JSONB NOT NULL,
  "labels" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AnalyticsFeatureSnapshot_orgId_asOf_idx"
  ON "AnalyticsFeatureSnapshot" ("orgId", "asOf");

ALTER TABLE "AnalyticsFeatureSnapshot"
  ADD CONSTRAINT "AnalyticsFeatureSnapshot_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
