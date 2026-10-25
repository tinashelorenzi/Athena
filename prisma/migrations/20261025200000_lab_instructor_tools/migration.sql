-- Labs M5: instructor score overrides, re-grade markers, and the lab.yaml source +
-- reference evidence kept per version for the in-browser check editor.
-- AlterTable
ALTER TABLE "lab_check_runs" ADD COLUMN     "gradedWithVersionId" TEXT,
ADD COLUMN     "regradedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lab_sessions" ADD COLUMN     "overrideAt" TIMESTAMP(3),
ADD COLUMN     "overrideById" TEXT,
ADD COLUMN     "overrideReason" TEXT,
ADD COLUMN     "overrideScore" INTEGER;

-- AlterTable
ALTER TABLE "lab_versions" ADD COLUMN     "references" JSONB,
ADD COLUMN     "source" TEXT;

