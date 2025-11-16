ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "onboardingComplete" BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE "Organization"
SET "onboardingComplete" = TRUE
WHERE "onboardingComplete" = FALSE;

ALTER TABLE "Org"
ADD COLUMN IF NOT EXISTS "onboardingComplete" BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE "Org"
SET "onboardingComplete" = TRUE
WHERE "onboardingComplete" = FALSE;
