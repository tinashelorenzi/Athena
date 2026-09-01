-- Instructor "commit" locks a submission for grading (student can't re-submit).
ALTER TABLE "submissions" ADD COLUMN "committedAt" TIMESTAMP(3);
ALTER TABLE "submissions" ADD COLUMN "committedById" TEXT;

-- Existing graded submissions were already effectively locked — mark committed.
UPDATE "submissions" SET "committedAt" = COALESCE("gradedAt", "submittedAt") WHERE "status" = 'GRADED';
