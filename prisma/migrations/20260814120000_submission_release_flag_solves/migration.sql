-- Submission: uploaded report file + grade-release gating
ALTER TABLE "submissions" ADD COLUMN "reportFileKey" TEXT;
ALTER TABLE "submissions" ADD COLUMN "reportFileName" TEXT;
ALTER TABLE "submissions" ADD COLUMN "reportFileType" TEXT;
ALTER TABLE "submissions" ADD COLUMN "reportFileSize" INTEGER;
ALTER TABLE "submissions" ADD COLUMN "releasedAt" TIMESTAMP(3);

-- Back-fill: existing graded submissions are treated as already released so
-- students don't lose grades they can already see.
UPDATE "submissions" SET "releasedAt" = COALESCE("gradedAt", "submittedAt") WHERE "status" = 'GRADED';

-- FlagSolve: per-flag Dojo answer checks
CREATE TABLE "flag_solves" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flag_solves_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flag_solves_scenarioId_studentId_flagId_key" ON "flag_solves"("scenarioId", "studentId", "flagId");
CREATE INDEX "flag_solves_studentId_idx" ON "flag_solves"("studentId");

ALTER TABLE "flag_solves" ADD CONSTRAINT "flag_solves_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flag_solves" ADD CONSTRAINT "flag_solves_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
