CREATE EXTENSION IF NOT EXISTS "pgcrypto";
DO $$
BEGIN
  CREATE TYPE "FeedbackRole" AS ENUM ('FINANCE', 'REGULATOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ModelFeedback" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "predictionId" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "submittedBy" TEXT NOT NULL,
  "submittedRole" "FeedbackRole" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ModelFeedback_predictionId_modelVersion_idx"
  ON "ModelFeedback" ("predictionId", "modelVersion");
CREATE INDEX IF NOT EXISTS "ModelFeedback_submittedRole_createdAt_idx"
  ON "ModelFeedback" ("submittedRole", "createdAt");
