-- CreateEnum
CREATE TYPE "ModelFeedbackLabel" AS ENUM ('FALSE_POSITIVE', 'FALSE_NEGATIVE');

-- CreateTable
CREATE TABLE "ModelFeedback" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "inferenceId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT,
    "predictedLabel" TEXT,
    "expectedLabel" TEXT,
    "label" "ModelFeedbackLabel" NOT NULL,
    "submittedById" TEXT,
    "notes" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelFeedback_orgId_inferenceId_idx" ON "ModelFeedback"("orgId", "inferenceId");
CREATE INDEX "ModelFeedback_orgId_modelName_modelVersion_idx" ON "ModelFeedback"("orgId", "modelName", "modelVersion");
CREATE INDEX "ModelFeedback_label_idx" ON "ModelFeedback"("label");
CREATE UNIQUE INDEX "ModelFeedback_orgId_inferenceId_key" ON "ModelFeedback"("orgId", "inferenceId");

-- AddForeignKey
ALTER TABLE "ModelFeedback" ADD CONSTRAINT "ModelFeedback_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelFeedback" ADD CONSTRAINT "ModelFeedback_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
