-- CreateEnum
CREATE TYPE "FeedbackLabel" AS ENUM ('FALSE_POSITIVE', 'FALSE_NEGATIVE');

-- CreateEnum
CREATE TYPE "FeedbackSource" AS ENUM ('REGULATOR', 'FINANCE');

-- CreateTable
CREATE TABLE "ModelFeedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modelId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "label" "FeedbackLabel" NOT NULL,
    "source" "FeedbackSource" NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ModelFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelFeedback_modelId_modelVersion_idx" ON "ModelFeedback"("modelId", "modelVersion");

-- CreateIndex
CREATE INDEX "ModelFeedback_predictionId_idx" ON "ModelFeedback"("predictionId");

-- CreateIndex
CREATE INDEX "ModelFeedback_label_source_idx" ON "ModelFeedback"("label", "source");
